/**
 * The policy engine — PRD §8, ADR-0004.
 *
 * Deny by default, evaluated server-side, in the order §8.1 prescribes. Every
 * stage may deny and stop; only a full pass allows. Explicit deny always wins.
 *
 * The decision is made **before the record is loaded**. That is not an
 * optimisation, it is the security property: a check performed after loading has
 * already put the row — and its restricted columns — into memory, into a log
 * line, into an error payload. `fields` on the decision is the allowlist the
 * repository selects, so prohibited columns are never read at all (§8.5).
 */

import type { BaseRole, ExecutionContext, PolicyDecision, ProjectRole } from "@nesto/contracts";
import { forbidden } from "@nesto/contracts";
import { policyDenies } from "@nesto/observability";
import { getPermission } from "./registry";
import { roleGrants, patternMatches, OWNER_ONLY } from "./role-matrix";

export type GrantEffect = "ALLOW" | "DENY";

export type PermissionGrant = {
  permissionKey: string;
  effect: GrantEffect;
  /** COMPANY | PROJECT | RECORD — narrows where the grant applies. */
  scopeType: "COMPANY" | "PROJECT" | "RECORD";
  scopeId?: string;
  expiresAt?: Date | null;
};

/**
 * Everything the engine needs, resolved once per request by the API and passed
 * in. The engine performs no I/O: a policy layer that queries is a policy layer
 * that gets cached, and a cached permission is a revocation that does not
 * propagate (§25.1 requires immediate propagation on the source API).
 */
export type PolicySubject = {
  ctx: ExecutionContext;
  /** ACTIVE | DISABLED | INVITED */
  accountStatus: string;
  membership?: {
    id: string;
    companyId: string;
    role: BaseRole;
    /** PENDING | ACTIVE | SUSPENDED | ENDED */
    status: string;
    isPrimaryOwner: boolean;
    departmentId?: string | null;
  };
  /** The company's lifecycle state, already computed for wall-clock expiry. */
  companyLifecycle?: string;
  /** False when a material policy version is unaccepted (§9.3 step 7). */
  legalAcceptanceCurrent: boolean;
  grants: PermissionGrant[];
  projectMembership?: {
    projectId: string;
    projectRole: ProjectRole;
    /** SCHEDULED | ACTIVE | ENDED */
    status: string;
  };
  /** Project lifecycle, for the read-only states of §12.2. */
  projectLifecycle?: string;
  /** True when the caller re-authenticated within the recent-auth window. */
  recentlyAuthenticated?: boolean;
  /** Platform administrators, in the PLATFORM audience only. */
  isPlatformAdmin?: boolean;
};

export type EvaluateOptions = {
  /** The company or project the action targets, when it is not the active one. */
  scopeId?: string;
  /** Set for a mutation, so lifecycle read-only states can block it. */
  mutating?: boolean;
};

function deny(reason: string, key: string, ctx: ExecutionContext): PolicyDecision {
  policyDenies({ permission: key, audience: ctx.audience, reason });
  return { allow: false, reasons: [reason] };
}

/** Company states in which no business mutation is permitted (§9.1). */
const COMPANY_MUTABLE = new Set(["ACTIVE", "ACTIVE_ONBOARDING"]);
const COMPANY_READABLE = new Set(["ACTIVE", "ACTIVE_ONBOARDING", "READ_ONLY_GRACE"]);
/** Project states in which execution mutations are blocked (§12.2). */
const PROJECT_MUTABLE = new Set(["DRAFT", "ACTIVE"]);

export function evaluate(subject: PolicySubject, key: string, options: EvaluateOptions = {}): PolicyDecision {
  const { ctx } = subject;
  const definition = getPermission(key);

  // An undeclared key is a bug, and the safe reading of a bug is "no".
  if (!definition) return deny("permission-not-declared", key, ctx);

  // --- 1. Platform audience and privilege ---------------------------------
  if (key.startsWith("platform.")) {
    if (ctx.audience !== "PLATFORM" || !subject.isPlatformAdmin) {
      return deny("platform-permission-outside-platform-audience", key, ctx);
    }
    if (definition.recentAuthenticationRequired && !subject.recentlyAuthenticated) {
      return deny("recent-authentication-required", key, ctx);
    }
    return { allow: true, reasons: ["platform-admin"] };
  }
  // The converse matters just as much: Platform Admin has no routine access to
  // operational tenant data (§24.5, ACC-12). Being in the platform audience is
  // not a company permission.
  if (ctx.audience === "PLATFORM") {
    return deny("platform-audience-has-no-operational-access", key, ctx);
  }

  // --- 2. Account and session state ---------------------------------------
  if (subject.accountStatus !== "ACTIVE") return deny(`account-${subject.accountStatus.toLowerCase()}`, key, ctx);

  // --- 3. Tenant and active company membership ----------------------------
  if (ctx.audience === "COMPANY") {
    if (!subject.membership) return deny("no-company-membership", key, ctx);
    if (subject.membership.status !== "ACTIVE") {
      return deny(`membership-${subject.membership.status.toLowerCase()}`, key, ctx);
    }
    if (subject.membership.companyId !== ctx.activeCompanyId) {
      return deny("membership-is-for-a-different-company", key, ctx);
    }
  }

  // --- 4. Company lifecycle and legal gates -------------------------------
  const lifecycle = subject.companyLifecycle;
  if (lifecycle && !COMPANY_READABLE.has(lifecycle)) {
    return deny(`company-${lifecycle.toLowerCase()}`, key, ctx);
  }
  if (options.mutating && lifecycle && !COMPANY_MUTABLE.has(lifecycle)) {
    // READ_ONLY_GRACE lands here: exports still work, business writes do not.
    return deny(`company-${lifecycle.toLowerCase()}-blocks-mutation`, key, ctx);
  }
  if (!subject.legalAcceptanceCurrent) return deny("legal-acceptance-required", key, ctx);

  // --- 5. Owner-protected authority (§8.6) --------------------------------
  // Checked before the role matrix so that no accumulation of grants can reach
  // Owner authority: a Company Admin with every explicit grant in the system
  // still cannot transfer ownership.
  if (isOwnerOnly(key) && !subject.membership?.isPrimaryOwner) {
    return deny("owner-only", key, ctx);
  }

  // --- 6. Explicit denies beat everything below ---------------------------
  const applicable = subject.grants.filter(
    (g) => matchesGrant(g, key) && withinScope(g, ctx, options) && !expired(g, ctx)
  );
  if (applicable.some((g) => g.effect === "DENY")) return deny("explicit-deny", key, ctx);

  // --- 7. Base role, then explicit allow ----------------------------------
  const roleAllows = subject.membership ? roleGrants(subject.membership.role, key) : false;
  const grantAllows = applicable.some((g) => g.effect === "ALLOW");
  if (!roleAllows && !grantAllows) return deny("no-grant", key, ctx);

  // --- 8. Project membership and project lifecycle ------------------------
  if (needsProjectScope(key, definition.allowedScopes) && ctx.activeProjectId) {
    // Project assignment does not create access, and company-wide authority is
    // the alternative route in (§8.3) — so a project permission needs either an
    // active project membership or an explicit company-scoped grant.
    const hasProjectMembership =
      subject.projectMembership?.projectId === ctx.activeProjectId &&
      subject.projectMembership.status === "ACTIVE";
    const hasCompanyWide = applicable.some((g) => g.effect === "ALLOW" && g.scopeType === "COMPANY");
    if (!hasProjectMembership && !hasCompanyWide && !roleAllowsCompanyWide(subject)) {
      return deny("not-a-member-of-this-project", key, ctx);
    }
    if (options.mutating && subject.projectLifecycle && !PROJECT_MUTABLE.has(subject.projectLifecycle)) {
      return deny(`project-${subject.projectLifecycle.toLowerCase()}-blocks-mutation`, key, ctx);
    }
  }

  // --- 9. Recent authentication for privileged actions --------------------
  if (definition.recentAuthenticationRequired && !subject.recentlyAuthenticated) {
    return deny("recent-authentication-required", key, ctx);
  }

  return { allow: true, reasons: [roleAllows ? "role" : "explicit-grant"] };
}

/** Throwing form, for services that have nothing sensible to do with a `false`. */
export function assertAllowed(subject: PolicySubject, key: string, options: EvaluateOptions = {}): void {
  const decision = evaluate(subject, key, options);
  if (!decision.allow) throw forbidden(key, decision.reasons.join(","));
}

function isOwnerOnly(key: string): boolean {
  return OWNER_ONLY.includes(key);
}

function matchesGrant(grant: PermissionGrant, key: string): boolean {
  return patternMatches(grant.permissionKey, key);
}

function withinScope(grant: PermissionGrant, ctx: ExecutionContext, options: EvaluateOptions): boolean {
  if (!grant.scopeId) return true;
  const target = options.scopeId ?? ctx.activeProjectId ?? ctx.activeCompanyId;
  return grant.scopeId === target || grant.scopeId === ctx.activeCompanyId;
}

function expired(grant: PermissionGrant, ctx: ExecutionContext): boolean {
  return Boolean(grant.expiresAt && grant.expiresAt.getTime() <= new Date(ctx.now).getTime());
}

function needsProjectScope(key: string, allowedScopes: readonly string[]): boolean {
  return allowedScopes.includes("PROJECT") && !allowedScopes.includes("COMPANY");
}

/** OWNER, COMPANY_ADMIN and EXECUTIVE act across a company's projects without
 *  being enrolled in each one; every other role needs a membership. */
function roleAllowsCompanyWide(subject: PolicySubject): boolean {
  const role = subject.membership?.role;
  return role === "OWNER" || role === "COMPANY_ADMIN" || role === "EXECUTIVE";
}
