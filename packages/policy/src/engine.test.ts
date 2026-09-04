/**
 * Authorization invariants — PRD §8, and acceptance criteria ACC-09 through
 * ACC-13. Each test names the rule it defends.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { ExecutionContext, PermissionDefinition } from "@nesto/contracts";
import { registerPermissions, clearPermissionsForTest } from "./registry";
import { evaluate, type PolicySubject } from "./engine";
import { roleGrants, ROLE_MATRIX, patternMatches } from "./role-matrix";
import { resolveFields, applyFieldPolicy, toSelect } from "./fields";

const ctx: ExecutionContext = {
  requestId: "r", correlationId: "c", actorType: "USER", actorId: "u",
  audience: "COMPANY", tenantId: "t1", activeCompanyId: "c1",
  locale: "en", now: "2026-09-04T12:00:00.000Z",
};

function permission(key: string, extra: Partial<PermissionDefinition> = {}): PermissionDefinition {
  return {
    key, domain: key.split(".")[0] as string, description: key,
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: false, ...extra,
  };
}

function subject(over: Partial<PolicySubject> = {}): PolicySubject {
  return {
    ctx,
    accountStatus: "ACTIVE",
    membership: { id: "m1", companyId: "c1", role: "PROJECT_MANAGER", status: "ACTIVE", isPrimaryOwner: false },
    companyLifecycle: "ACTIVE",
    legalAcceptanceCurrent: true,
    grants: [],
    ...over,
  };
}

beforeEach(() => {
  clearPermissionsForTest();
  registerPermissions([
    permission("project.read"),
    permission("project.settings.update", { actions: ["UPDATE"] }),
    permission("finance.payment.post", { actions: ["APPROVE"], sensitive: true, auditRequired: true }),
    permission("company.owner.transfer", { actions: ["UPDATE"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true }),
    permission("platform.company.activate", { domain: "platform", allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true }),
    permission("task.update.assigned", { allowedScopes: ["PROJECT", "ASSIGNED"], actions: ["UPDATE"] }),
    permission("hr.salary.read", { sensitive: true, auditRequired: true }),
  ]);
});

describe("deny by default", () => {
  it("refuses a permission nobody declared", () => {
    // A key that exists only as a typed string is a bug, and the safe reading
    // of a bug is "no".
    expect(evaluate(subject(), "project.invented").allow).toBe(false);
  });

  it("refuses when the role does not hold it and no grant supplies it", () => {
    const s = subject({ membership: { id: "m", companyId: "c1", role: "FIELD", status: "ACTIVE", isPrimaryOwner: false } });
    expect(evaluate(s, "project.settings.update").reasons).toContain("no-grant");
  });
});

describe("ACC-12 — Platform Admin has no routine operational access", () => {
  it("refuses a company permission to the platform audience", () => {
    const s = subject({ ctx: { ...ctx, audience: "PLATFORM" }, isPlatformAdmin: true, membership: undefined });
    expect(evaluate(s, "project.read").reasons).toContain("platform-audience-has-no-operational-access");
  });

  it("refuses a platform permission to a company session", () => {
    expect(evaluate(subject(), "platform.company.activate").allow).toBe(false);
  });

  it("allows a platform permission only to a platform admin in the platform audience", () => {
    const s = subject({ ctx: { ...ctx, audience: "PLATFORM" }, isPlatformAdmin: true, membership: undefined });
    expect(evaluate(s, "platform.company.activate").allow).toBe(true);
    expect(evaluate({ ...s, isPlatformAdmin: false }, "platform.company.activate").allow).toBe(false);
  });
});

describe("account, session and membership state", () => {
  it("refuses a disabled account everywhere", () => {
    expect(evaluate(subject({ accountStatus: "DISABLED" }), "project.read").reasons).toContain("account-disabled");
  });

  it("refuses a suspended membership", () => {
    const s = subject({ membership: { id: "m", companyId: "c1", role: "OWNER", status: "SUSPENDED", isPrimaryOwner: true } });
    expect(evaluate(s, "project.read").reasons).toContain("membership-suspended");
  });

  it("refuses a membership belonging to another company", () => {
    // §7.3: an invitation to one company grants no access to another.
    const s = subject({ membership: { id: "m", companyId: "c2", role: "OWNER", status: "ACTIVE", isPrimaryOwner: true } });
    expect(evaluate(s, "project.read").reasons).toContain("membership-is-for-a-different-company");
  });
});

describe("company lifecycle gates (§9.1)", () => {
  it("allows reads during the 120-hour grace but blocks business writes", () => {
    const s = subject({ companyLifecycle: "READ_ONLY_GRACE", membership: { id: "m", companyId: "c1", role: "OWNER", status: "ACTIVE", isPrimaryOwner: true } });
    expect(evaluate(s, "project.read").allow).toBe(true);
    expect(evaluate(s, "project.settings.update", { mutating: true }).reasons)
      .toContain("company-read_only_grace-blocks-mutation");
  });

  it("blocks everything once locked", () => {
    const s = subject({ companyLifecycle: "LOCKED", membership: { id: "m", companyId: "c1", role: "OWNER", status: "ACTIVE", isPrimaryOwner: true } });
    expect(evaluate(s, "project.read").allow).toBe(false);
  });

  it("blocks while an unaccepted material policy version stands", () => {
    expect(evaluate(subject({ legalAcceptanceCurrent: false }), "project.read").reasons)
      .toContain("legal-acceptance-required");
  });
});

describe("ACC-13 — Company Admin cannot assume Owner authority (§8.6)", () => {
  it("refuses ownership transfer to a Company Admin", () => {
    const s = subject({ membership: { id: "m", companyId: "c1", role: "COMPANY_ADMIN", status: "ACTIVE", isPrimaryOwner: false }, recentlyAuthenticated: true });
    expect(evaluate(s, "company.owner.transfer").reasons).toContain("owner-only");
  });

  it("refuses it even when an explicit grant says otherwise", () => {
    // The owner check runs before grants are considered, so no accumulation of
    // permissions adds up to Owner authority.
    const s = subject({
      membership: { id: "m", companyId: "c1", role: "COMPANY_ADMIN", status: "ACTIVE", isPrimaryOwner: false },
      grants: [{ permissionKey: "company.owner.transfer", effect: "ALLOW", scopeType: "COMPANY" }],
      recentlyAuthenticated: true,
    });
    expect(evaluate(s, "company.owner.transfer").reasons).toContain("owner-only");
  });

  it("allows the Primary Owner, but only with recent authentication", () => {
    const owner = subject({ membership: { id: "m", companyId: "c1", role: "OWNER", status: "ACTIVE", isPrimaryOwner: true } });
    expect(evaluate(owner, "company.owner.transfer").reasons).toContain("recent-authentication-required");
    expect(evaluate({ ...owner, recentlyAuthenticated: true }, "company.owner.transfer").allow).toBe(true);
  });

  it("keeps Finance out of the Company Admin role entirely", () => {
    // Separation of duties: an administrator who can also post payments is a
    // single point of both access and money.
    expect(roleGrants("COMPANY_ADMIN", "finance.payment.post")).toBe(false);
    expect(roleGrants("FINANCE", "finance.payment.post")).toBe(true);
  });
});

describe("explicit deny wins (§8.1)", () => {
  it("beats the role that would otherwise allow", () => {
    const s = subject({
      membership: { id: "m", companyId: "c1", role: "OWNER", status: "ACTIVE", isPrimaryOwner: true },
      grants: [{ permissionKey: "project.read", effect: "DENY", scopeType: "COMPANY" }],
    });
    expect(evaluate(s, "project.read").reasons).toContain("explicit-deny");
  });

  it("beats an explicit allow on the same key", () => {
    const s = subject({
      grants: [
        { permissionKey: "finance.payment.post", effect: "ALLOW", scopeType: "COMPANY" },
        { permissionKey: "finance.*", effect: "DENY", scopeType: "COMPANY" },
      ],
    });
    expect(evaluate(s, "finance.payment.post").reasons).toContain("explicit-deny");
  });

  it("ignores a grant that has expired", () => {
    const s = subject({
      membership: { id: "m", companyId: "c1", role: "FIELD", status: "ACTIVE", isPrimaryOwner: false },
      grants: [{
        permissionKey: "finance.payment.post", effect: "ALLOW", scopeType: "COMPANY",
        expiresAt: new Date("2026-09-01T00:00:00Z"),
      }],
    });
    expect(evaluate(s, "finance.payment.post").allow).toBe(false);
  });
});

describe("ACC-10 — project participation is not access (§8.3)", () => {
  it("refuses a project-scoped permission without an active project membership", () => {
    const s = subject({
      ctx: { ...ctx, activeProjectId: "p1" },
      membership: { id: "m", companyId: "c1", role: "FIELD", status: "ACTIVE", isPrimaryOwner: false },
      grants: [{ permissionKey: "task.update.assigned", effect: "ALLOW", scopeType: "PROJECT", scopeId: "p1" }],
    });
    expect(evaluate(s, "task.update.assigned").reasons).toContain("not-a-member-of-this-project");
  });

  it("allows it once the project membership is active", () => {
    const s = subject({
      ctx: { ...ctx, activeProjectId: "p1" },
      membership: { id: "m", companyId: "c1", role: "FIELD", status: "ACTIVE", isPrimaryOwner: false },
      projectMembership: { projectId: "p1", projectRole: "CONTRIBUTOR", status: "ACTIVE" },
    });
    expect(evaluate(s, "task.update.assigned").allow).toBe(true);
  });

  it("refuses a membership that is scheduled but not yet active", () => {
    const s = subject({
      ctx: { ...ctx, activeProjectId: "p1" },
      membership: { id: "m", companyId: "c1", role: "FIELD", status: "ACTIVE", isPrimaryOwner: false },
      projectMembership: { projectId: "p1", projectRole: "CONTRIBUTOR", status: "SCHEDULED" },
    });
    expect(evaluate(s, "task.update.assigned").allow).toBe(false);
  });

  it("lets company-wide roles act without being enrolled in every project", () => {
    const s = subject({
      ctx: { ...ctx, activeProjectId: "p1" },
      membership: { id: "m", companyId: "c1", role: "COMPANY_ADMIN", status: "ACTIVE", isPrimaryOwner: false },
    });
    expect(evaluate(s, "task.update.assigned").allow).toBe(true);
  });

  it("blocks execution mutations on a closed project", () => {
    const s = subject({
      ctx: { ...ctx, activeProjectId: "p1" },
      projectMembership: { projectId: "p1", projectRole: "MANAGER", status: "ACTIVE" },
      projectLifecycle: "CLOSED",
    });
    expect(evaluate(s, "task.update.assigned", { mutating: true }).reasons)
      .toContain("project-closed-blocks-mutation");
  });
});

describe("the role matrix", () => {
  it("gives every one of the 14 roles an allowlist and a stated reason", () => {
    const roles = Object.keys(ROLE_MATRIX);
    expect(roles).toHaveLength(14);
    for (const [role, entry] of Object.entries(ROLE_MATRIX)) {
      expect(entry.allow.length, `${role} has no permissions`).toBeGreaterThan(0);
      expect(entry.note.length, `${role} has no rationale`).toBeGreaterThan(20);
    }
  });

  it("gives OWNER nothing under platform.*", () => {
    // Platform Control is a different audience, not a higher rung of the
    // company ladder (§3.1).
    expect(roleGrants("OWNER", "platform.company.activate")).toBe(false);
  });

  it("does not let HR grant system access", () => {
    // §16.3: hiring never creates an account. HR owns employment; access is an
    // explicit invitation from someone else.
    expect(roleGrants("HR", "membership.invite")).toBe(false);
    expect(roleGrants("IT", "membership.invite")).toBe(true);
  });

  it("does not let IT read the audit trail", () => {
    // The role that grants access must not curate the record of who granted it.
    expect(roleGrants("IT", "audit.read")).toBe(false);
  });

  it("does not let Procurement approve its own award", () => {
    // §17.5: selection is final only after a central approval.
    expect(roleGrants("PROCUREMENT", "tender.award.approve")).toBe(false);
    expect(roleGrants("EXECUTIVE", "tender.award.approve")).toBe(true);
  });

  it("gives FIELD no commercial visibility at all", () => {
    for (const key of ["finance.read", "contract.read", "procurement.read", "crm.read"]) {
      expect(roleGrants("FIELD", key), key).toBe(false);
    }
  });

  it("matches a trailing wildcard but not a bare prefix of another word", () => {
    expect(patternMatches("finance.*", "finance.payment.post")).toBe(true);
    expect(patternMatches("finance.*", "finance")).toBe(true);
    expect(patternMatches("finance.*", "financial.read")).toBe(false);
    expect(patternMatches("project.read", "project.read.all")).toBe(false);
  });
});

describe("field-level policy (§8.5)", () => {
  const rule = {
    base: ["id", "displayName", "position"],
    guarded: { grossSalary: "hr.salary.read", medicalNotes: "hr.medical.read" },
  };

  it("returns only the base fields when the guarded permissions are missing", () => {
    const s = subject({ membership: { id: "m", companyId: "c1", role: "PROJECT_MANAGER", status: "ACTIVE", isPrimaryOwner: false } });
    const decision = resolveFields(s, "project.read", rule);
    expect([...(decision.fields ?? [])]).toEqual(["id", "displayName", "position"]);
    expect(decision.reasons).toContain("field-withheld:grossSalary");
  });

  it("unlocks a guarded field for the role that holds its permission", () => {
    const s = subject({ membership: { id: "m", companyId: "c1", role: "HR", status: "ACTIVE", isPrimaryOwner: false } });
    const decision = resolveFields(s, "project.read", rule);
    expect(decision.fields?.has("grossSalary")).toBe(true);
  });

  it("produces a select, so the withheld column is never read at all", () => {
    const select = toSelect(new Set(["id", "displayName"]), rule.base);
    expect(select).toEqual({ id: true, displayName: true });
    expect(select).not.toHaveProperty("grossSalary");
  });

  it("strips withheld fields from a payload that did not come from a select", () => {
    const decision = { allow: true, fields: new Set(["id"]), reasons: [] };
    expect(applyFieldPolicy({ id: "1", grossSalary: 5000 }, decision)).toEqual({ id: "1" });
  });

  it("returns nothing at all when the read itself is denied", () => {
    expect(applyFieldPolicy({ id: "1" }, { allow: false, reasons: [] })).toEqual({});
  });
});
