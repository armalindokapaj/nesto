/**
 * The execution context — PRD §6.2, verbatim in shape.
 *
 * Every authenticated operation receives one, resolved by the server. The single
 * most important property of this type is that it is *not* constructible from a
 * request body: a client-supplied tenant, company or project identifier is a
 * selection request, and the resolver validates it against the caller's identity,
 * membership, relationship and lifecycle before a context exists at all (§6.2).
 *
 * It is the first parameter of every repository method (ADR-0005). That is what
 * makes an unscoped query unwritable rather than merely discouraged.
 */

export type ActorType = "USER" | "PLATFORM_ADMIN" | "EXTERNAL_USER" | "SYSTEM";

export type Audience = "COMPANY" | "PLATFORM" | "EXTERNAL_PORTAL" | "PUBLIC";

export type Locale = "en" | "sq";

export type ExecutionContext = {
  requestId: string;
  correlationId: string;
  actorType: ActorType;
  actorId: string;
  audience: Audience;
  tenantId?: string;
  activeCompanyId?: string;
  activeProjectId?: string;
  membershipId?: string;
  externalOrganizationId?: string;
  sessionId?: string;
  locale: Locale;
  /** ISO-8601 instant fixed for the whole operation, so two reads inside one
   *  command cannot disagree about what "now" means. */
  now: string;
};

/** A context that has a tenant. Most domain work requires this narrowing. */
export type TenantContext = ExecutionContext & { tenantId: string };

/** A context that has an active company. Company-owned aggregates require it. */
export type CompanyContext = TenantContext & { activeCompanyId: string };

/** A context that has an active project. Project-scoped aggregates require it. */
export type ProjectContext = CompanyContext & { activeProjectId: string };

export function isTenantContext(ctx: ExecutionContext): ctx is TenantContext {
  return typeof ctx.tenantId === "string" && ctx.tenantId.length > 0;
}

export function isCompanyContext(ctx: ExecutionContext): ctx is CompanyContext {
  return isTenantContext(ctx) && typeof ctx.activeCompanyId === "string";
}

export function isProjectContext(ctx: ExecutionContext): ctx is ProjectContext {
  return isCompanyContext(ctx) && typeof ctx.activeProjectId === "string";
}

/**
 * Narrowing helpers that throw rather than return false. Used at the top of a
 * service so the failure names the missing scope instead of surfacing later as
 * a confusing "undefined tenantId" deep inside a query.
 */
export function requireTenant(ctx: ExecutionContext): TenantContext {
  if (!isTenantContext(ctx)) {
    throw new Error("ExecutionContext has no tenant; this operation requires one.");
  }
  return ctx;
}

export function requireCompany(ctx: ExecutionContext): CompanyContext {
  if (!isCompanyContext(ctx)) {
    throw new Error("ExecutionContext has no active company; this operation requires one.");
  }
  return ctx;
}

export function requireProject(ctx: ExecutionContext): ProjectContext {
  if (!isProjectContext(ctx)) {
    throw new Error("ExecutionContext has no active project; this operation requires one.");
  }
  return ctx;
}

/** The SYSTEM context used by workers and migrations. Deliberately explicit:
 *  a job that needs tenant scope must be given it in its payload (§20.8). */
export function systemContext(params: {
  requestId: string;
  correlationId: string;
  tenantId?: string;
  activeCompanyId?: string;
  activeProjectId?: string;
  now?: string;
}): ExecutionContext {
  return {
    requestId: params.requestId,
    correlationId: params.correlationId,
    actorType: "SYSTEM",
    actorId: "system",
    audience: "PLATFORM",
    tenantId: params.tenantId,
    activeCompanyId: params.activeCompanyId,
    activeProjectId: params.activeProjectId,
    locale: "en",
    now: params.now ?? new Date().toISOString(),
  };
}
