import { describe, it, expect } from "vitest";
import {
  requireTenant, requireCompany, requireProject, isTenantContext, systemContext,
  ERROR_CODES, NestoError, notFoundInScope, forbidden, versionConflict,
  isValidPermissionKey, BASE_ROLES, PROJECT_ROLES, PERMISSION_DOMAINS,
  type ExecutionContext,
} from "./index";

const base: ExecutionContext = {
  requestId: "req-1",
  correlationId: "corr-1",
  actorType: "USER",
  actorId: "user-1",
  audience: "COMPANY",
  locale: "en",
  now: "2026-09-04T12:00:00.000Z",
};

describe("execution context", () => {
  it("refuses to narrow a context that has no tenant", () => {
    expect(() => requireTenant(base)).toThrow(/no tenant/);
    expect(isTenantContext(base)).toBe(false);
  });

  it("narrows progressively and each level requires the one below it", () => {
    const tenant = { ...base, tenantId: "t1" };
    expect(requireTenant(tenant).tenantId).toBe("t1");
    expect(() => requireCompany(tenant)).toThrow(/active company/);

    const company = { ...tenant, activeCompanyId: "c1" };
    expect(requireCompany(company).activeCompanyId).toBe("c1");
    expect(() => requireProject(company)).toThrow(/active project/);

    const project = { ...company, activeProjectId: "p1" };
    expect(requireProject(project).activeProjectId).toBe("p1");
  });

  it("treats an empty-string tenant as absent, not as a scope", () => {
    expect(isTenantContext({ ...base, tenantId: "" })).toBe(false);
  });

  it("gives a system context no tenant unless one is supplied in the payload", () => {
    // §20.8: a job that needs tenant scope must carry it explicitly.
    const ctx = systemContext({ requestId: "r", correlationId: "c" });
    expect(ctx.actorType).toBe("SYSTEM");
    expect(ctx.tenantId).toBeUndefined();
    expect(systemContext({ requestId: "r", correlationId: "c", tenantId: "t1" }).tenantId).toBe("t1");
  });

  it("fixes `now` for the whole operation", () => {
    const ctx = systemContext({ requestId: "r", correlationId: "c", now: "2026-01-01T00:00:00.000Z" });
    expect(ctx.now).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("errors", () => {
  it("maps every §19.8 code to its documented status", () => {
    expect(ERROR_CODES.FORBIDDEN.status).toBe(403);
    expect(ERROR_CODES.COMPANY_READ_ONLY.status).toBe(423);
    expect(ERROR_CODES.LEGAL_ACCEPTANCE_REQUIRED.status).toBe(428);
    expect(ERROR_CODES.SCHEDULE_PREVIEW_STALE.status).toBe(409);
    expect(ERROR_CODES.RATE_LIMITED.status).toBe(429);
  });

  it("keeps the real reason out of the message a caller sees", () => {
    // §19.3: a response must not reveal whether an unauthorized record exists.
    const err = notFoundInScope("Contract", "row exists but belongs to tenant t2");
    expect(err.message).not.toContain("t2");
    expect(err.internalReason).toContain("t2");
    expect(err.status).toBe(404);
  });

  it("names the missing permission internally but not to the caller", () => {
    const err = forbidden("finance.payment.post");
    expect(err.message).not.toContain("finance.payment.post");
    expect(err.meta?.permissionKey).toBe("finance.payment.post");
  });

  it("reports a version conflict as retryable-by-reload", () => {
    const err = versionConflict(3, 5);
    expect(err.status).toBe(409);
    expect(err.meta).toEqual({ expectedVersion: 3, actualVersion: 5 });
  });

  it("keeps INTERNAL_ERROR separate so an unmapped throw cannot pose as a business error", () => {
    expect(new NestoError("INTERNAL_ERROR", "x").status).toBe(500);
    expect(Object.keys(ERROR_CODES)).toContain("INTERNAL_ERROR");
  });
});

describe("permission vocabulary", () => {
  it("accepts a namespaced key under a declared domain", () => {
    for (const key of [
      "project.read", "project.settings.update", "wbs.manage", "task.update.assigned",
      "document.revision.issue", "finance.payment.post", "procurement.tender.select_preferred",
      "workflow.approval.decide", "network.project_invitation.manage", "platform.company.activate",
    ]) {
      expect(isValidPermissionKey(key)).toBe(true);
    }
  });

  it("rejects an undeclared prefix, a bare word and the wrong case", () => {
    expect(isValidPermissionKey("nonsense.read")).toBe(false);
    expect(isValidPermissionKey("project")).toBe(false);
    expect(isValidPermissionKey("Project.Read")).toBe(false);
  });

  it("carries exactly the 14 base roles and 5 project roles of §8.2/§8.3", () => {
    expect(BASE_ROLES.length).toBe(14);
    expect(PROJECT_ROLES.length).toBe(5);
    // External participants are deliberately absent: they are not company
    // members at all (engineering response C9).
    expect(BASE_ROLES as readonly string[]).not.toContain("CLIENT");
    expect(BASE_ROLES as readonly string[]).not.toContain("CONTRACTOR");
    expect(BASE_ROLES as readonly string[]).toContain("COMPANY_ADMIN");
    expect(BASE_ROLES as readonly string[]).toContain("QA_QC");
  });

  it("declares all 30 Appendix B domain prefixes", () => {
    expect(PERMISSION_DOMAINS.length).toBe(30);
  });
});
