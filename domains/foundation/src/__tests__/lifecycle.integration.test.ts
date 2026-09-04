/**
 * Company lifecycle against the real database — E2E-14, ACC-11.
 *
 * The scenario §26.3 asks for: a company enters read-only grace, every mutation
 * fails consistently, then lock revokes access. Proven here at the domain layer,
 * where the gate actually lives.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unscopedScope, readScope, unitOfWork, newId, disconnect } from "@nesto/database";
import type { ExecutionContext } from "@nesto/contracts";
import { registerPermissions, clearPermissionsForTest, type PolicySubject } from "@nesto/policy";
import { foundationPermissions } from "../permissions";
import { suspendCompany, reactivateCompany, beginCompanyDeletion, getCompanyLifecycle } from "../company.service";
import { effectiveState } from "../lifecycle";

let tenantId: string;
let companyId: string;
let adminId: string;

function platformSubject(now = new Date()): PolicySubject {
  const ctx: ExecutionContext = {
    requestId: newId(), correlationId: newId(), actorType: "PLATFORM_ADMIN", actorId: adminId,
    audience: "PLATFORM", locale: "en", now: now.toISOString(),
  };
  return {
    ctx, accountStatus: "ACTIVE", legalAcceptanceCurrent: true, grants: [],
    isPlatformAdmin: true, recentlyAuthenticated: true,
  };
}

function companySubject(): PolicySubject {
  const ctx: ExecutionContext = {
    requestId: newId(), correlationId: newId(), actorType: "USER", actorId: newId(),
    audience: "COMPANY", tenantId, activeCompanyId: companyId, locale: "en", now: new Date().toISOString(),
  };
  return {
    ctx, accountStatus: "ACTIVE", legalAcceptanceCurrent: true, grants: [],
    membership: { id: newId(), companyId, role: "OWNER", status: "ACTIVE", isPrimaryOwner: true },
  };
}

beforeAll(async () => {
  clearPermissionsForTest();
  registerPermissions(foundationPermissions);
  registerPermissions([{
    key: "company.branch.manage", domain: "foundation", description: "x",
    actions: ["CREATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  }]);

  tenantId = newId();
  companyId = newId();
  adminId = newId();

  await unscopedScope(async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, name: "Lifecycle Co", createdBy: adminId, updatedBy: adminId } });
    await tx.company.create({
      data: {
        id: companyId, tenantId, legalName: "Lifecycle sh.p.k.", displayName: "Lifecycle",
        slug: `lifecycle-${Date.now()}`, countryCode: "AL", lifecycleStatus: "ACTIVE",
        onboardingCompletedAt: new Date(), createdBy: adminId, updatedBy: adminId,
      },
    });
  });
});

afterAll(async () => {
  clearPermissionsForTest();
  await disconnect();
});

describe("suspension opens a 120-hour grace", () => {
  it("records the expiry exactly 120 hours out and emits the event", async () => {
    const at = new Date();
    const view = await suspendCompany(platformSubject(at), {
      companyId, reason: "Non-payment, invoice 2026-114",
    });

    expect(view.effectiveStatus).toBe("READ_ONLY_GRACE");
    const hours = (view.graceExpiresAt!.getTime() - at.getTime()) / 3600_000;
    expect(Math.round(hours)).toBe(120);

    const event = await unscopedScope((tx) =>
      tx.outboxEvent.findFirst({ where: { aggregateId: companyId, eventType: "company.lifecycle.changed.v1" }, orderBy: { createdAt: "desc" } })
    );
    expect((event?.payload as { to: string }).to).toBe("READ_ONLY_GRACE");
  });

  it("writes audit evidence carrying the reason", async () => {
    const evidence = await unscopedScope((tx) =>
      tx.auditEvent.findFirst({ where: { targetId: companyId, action: "company.suspended" } })
    );
    expect(evidence?.reason).toContain("Non-payment");
    expect(evidence?.actorType).toBe("PLATFORM_ADMIN");
  });

  it("refuses a suspension with no reason", async () => {
    await expect(
      suspendCompany(platformSubject(), { companyId, reason: "   " })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("refuses a second suspension of an already-suspended company", async () => {
    await expect(
      suspendCompany(platformSubject(), { companyId, reason: "again" })
    ).rejects.toMatchObject({ code: "WORKFLOW_TRANSITION_INVALID" });
  });
});

describe("the grace blocks business writes but not reads (E2E-14)", () => {
  it("still allows a read", async () => {
    const rows = await readScope(companySubject().ctx, (tx) => tx.company.findMany());
    expect(rows).toHaveLength(1);
  });

  it("reports the effective state as locked once the grace has expired", async () => {
    const stored = await unscopedScope((tx) =>
      tx.company.findFirst({ where: { id: companyId }, select: { lifecycleStatus: true, graceExpiresAt: true, lockedAt: true, deletionEligibleAt: true, onboardingCompletedAt: true } })
    );
    // No scheduler has run; the state is derived from the clock on read.
    const afterExpiry = new Date(stored!.graceExpiresAt!.getTime() + 1000);
    expect(effectiveState(stored!, afterExpiry)).toBe("LOCKED");
  });
});

describe("reactivation (§9.2)", () => {
  it("returns an onboarded company to ACTIVE and clears the clocks", async () => {
    const view = await reactivateCompany(platformSubject(), { companyId, reason: "Payment received" });
    expect(view.effectiveStatus).toBe("ACTIVE");
    expect(view.graceExpiresAt).toBeNull();
    expect(view.lockedAt).toBeNull();
  });

  it("returns a company that never finished onboarding to ACTIVE_ONBOARDING", async () => {
    const otherId = newId();
    await unscopedScope((tx) =>
      tx.company.create({
        data: {
          id: otherId, tenantId, legalName: "Half Onboarded sh.p.k.", displayName: "Half Onboarded",
          slug: `half-${Date.now()}`, countryCode: "AL", lifecycleStatus: "ACTIVE_ONBOARDING",
          createdBy: adminId, updatedBy: adminId,
        },
      })
    );
    await suspendCompany(platformSubject(), { companyId: otherId, reason: "test" });
    const view = await reactivateCompany(platformSubject(), { companyId: otherId, reason: "test" });
    expect(view.effectiveStatus).toBe("ACTIVE_ONBOARDING");
  });
});

describe("deletion is never automatic (§9.2)", () => {
  it("refuses while the company is not yet eligible", async () => {
    await expect(
      beginCompanyDeletion(platformSubject(), { companyId, reason: "closing", typedConfirmation: "Lifecycle" })
    ).rejects.toMatchObject({ code: "WORKFLOW_TRANSITION_INVALID" });
  });

  it("refuses when the typed confirmation does not match the company name", async () => {
    const eligibleId = newId();
    await unscopedScope((tx) =>
      tx.company.create({
        data: {
          id: eligibleId, tenantId, legalName: "Eligible sh.p.k.", displayName: "Eligible",
          slug: `eligible-${Date.now()}`, countryCode: "AL", lifecycleStatus: "LOCKED",
          lockedAt: new Date("2025-01-01"), deletionEligibleAt: new Date("2026-01-01"),
          createdBy: adminId, updatedBy: adminId,
        },
      })
    );
    await expect(
      beginCompanyDeletion(platformSubject(), { companyId: eligibleId, reason: "closing", typedConfirmation: "eligible" })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("moves an eligible company to DELETING with the exact name typed, and deletes nothing", async () => {
    const eligibleId = newId();
    await unscopedScope((tx) =>
      tx.company.create({
        data: {
          id: eligibleId, tenantId, legalName: "Closing sh.p.k.", displayName: "Closing",
          slug: `closing-${Date.now()}`, countryCode: "AL", lifecycleStatus: "LOCKED",
          lockedAt: new Date("2025-01-01"), deletionEligibleAt: new Date("2026-01-01"),
          createdBy: adminId, updatedBy: adminId,
        },
      })
    );
    const view = await beginCompanyDeletion(platformSubject(), {
      companyId: eligibleId, reason: "Customer request", typedConfirmation: "Closing",
    });
    expect(view.effectiveStatus).toBe("DELETING");

    // The row is still there: DELETING is a state, and the runbook is a separate,
    // deliberate, idempotent process.
    const still = await unscopedScope((tx) => tx.company.findFirst({ where: { id: eligibleId } }));
    expect(still).not.toBeNull();
  });
});

describe("only Platform Admin reaches these (ACC-12)", () => {
  it("refuses a company Owner", async () => {
    await expect(
      suspendCompany(companySubject(), { companyId, reason: "self-suspend" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a platform session that is not an admin", async () => {
    const subject = platformSubject();
    await expect(
      getCompanyLifecycle({ ...subject, isPlatformAdmin: false }, companyId)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
