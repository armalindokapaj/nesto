import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { transitionAsset, assignAsset, transferAsset } from "@/server/assets-module";
import { closeOpportunity } from "@/server/crm-module";
import { closeBudget } from "@/server/finance";
import { verifyEmail } from "@/server/public-signup";

// The audit's §2 follow-up: Phase 12 checked approve/reject/decide/release/sign,
// but the same read-then-write shape lived under close/confirm/finalize too.
// Three of those had no state check at all — an already-won opportunity could be
// re-closed as LOST, a closed budget re-closed, a closed observation re-closed —
// and the rest could lose a race. Asset was the Phase 20 case: recordVersion was
// incremented by every writer and read by none.
describe("state transition guards", () => {
  let tenantId: string;
  let companyId: string;
  let actorId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Guard Test", slug: `guards-${stamp}` } });
    tenantId = tenant.id;
    const company = await db.company.create({ data: { tenantId, name: "GC", isParent: true } });
    companyId = company.id;
    const actor = await db.userIdentity.create({
      data: { email: `gd-${stamp}@test.local`, username: `gd${stamp}`, displayName: "Guard Actor", passwordHash: "x" },
    });
    actorId = actor.id;
    await db.companyMembership.create({ data: { tenantId, userId: actorId, role: "ADMIN" } });
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.delete({ where: { id: actorId } }).catch(() => {});
  });

  describe("asset (Phase 20 — recordVersion was written but never read)", () => {
    let assetId: string;

    beforeEach(async () => {
      const asset = await db.asset.create({
        data: { tenantId, createdById: actorId, name: "Excavator", type: "EQUIPMENT", status: "ACTIVE", currency: "EUR" },
      });
      assetId = asset.id;
    });

    const assetRow = () => db.asset.findUniqueOrThrow({ where: { id: assetId } });

    it("transitions once and bumps recordVersion", async () => {
      await transitionAsset(tenantId, actorId, assetId, "MAINTENANCE");
      const row = await assetRow();
      expect(row.status).toBe("MAINTENANCE");
      expect(row.recordVersion).toBe(2);
    });

    it("lets only one of two concurrent transitions win", async () => {
      const results = await Promise.allSettled([
        transitionAsset(tenantId, actorId, assetId, "MAINTENANCE"),
        transitionAsset(tenantId, actorId, assetId, "RETIRED"),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);
      // and the loser must not have logged a status change that never happened
      const row = await assetRow();
      expect(row.recordVersion).toBe(2);
      const logged = await db.assetActivity.count({ where: { assetId, eventType: "asset.status_changed" } });
      expect(logged).toBe(1);
    });

    it("rolls back the assignment row when assignAsset loses the race", async () => {
      const results = await Promise.allSettled([
        assignAsset(tenantId, actorId, assetId, { assigneeType: "USER", assigneeName: "Ana" }),
        assignAsset(tenantId, actorId, assetId, { assigneeType: "USER", assigneeName: "Ben" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      // the losing transaction must leave no orphan assignment behind
      const open = await db.assetAssignment.count({ where: { assetId, returnedAt: null } });
      expect(open).toBe(1);
    });

    it("rolls back the transfer row when transferAsset loses the race", async () => {
      const move = (toName: string) =>
        transferAsset(tenantId, actorId, assetId, {
          fromType: "WAREHOUSE", fromName: "HQ", toType: "PROJECT", toName,
          transferredAt: new Date(), reason: "Site move",
        });
      const results = await Promise.allSettled([move("Site A"), move("Site B")]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const transfers = await db.assetTransfer.count({ where: { assetId } });
      expect(transfers).toBe(1);
    });
  });

  describe("closeOpportunity (had no state check at all)", () => {
    let opportunityId: string;

    beforeEach(async () => {
      const client = await db.client.create({ data: { tenantId, name: "Acme", createdById: actorId } });
      const pipeline = await db.pipeline.create({ data: { tenantId, name: `P${Date.now()}` } });
      const stage = await db.pipelineStage.create({ data: { tenantId, pipelineId: pipeline.id, name: "Lead", orderNo: 1 } });
      const opp = await db.opportunity.create({
        data: { tenantId, clientId: client.id, title: "Tower deal", pipelineId: pipeline.id, stageId: stage.id },
      });
      opportunityId = opp.id;
    });

    it("closes an open opportunity", async () => {
      await closeOpportunity(tenantId, { opportunityId, status: "WON", actorId });
      expect((await db.opportunity.findUniqueOrThrow({ where: { id: opportunityId } })).status).toBe("WON");
    });

    it("refuses to flip a won opportunity to lost", async () => {
      await closeOpportunity(tenantId, { opportunityId, status: "WON", actorId });
      await expect(
        closeOpportunity(tenantId, { opportunityId, status: "LOST", lostReason: "changed mind", actorId })
      ).rejects.toThrow(/already won/i);
      expect((await db.opportunity.findUniqueOrThrow({ where: { id: opportunityId } })).status).toBe("WON");
    });

    it("logs exactly one outcome for two concurrent closes", async () => {
      const results = await Promise.allSettled([
        closeOpportunity(tenantId, { opportunityId, status: "WON", actorId }),
        closeOpportunity(tenantId, { opportunityId, status: "LOST", lostReason: "x", actorId }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const logged = await db.crmActivityEvent.count({
        where: { tenantId, entityId: opportunityId, eventType: { in: ["OPPORTUNITY_WON", "OPPORTUNITY_LOST"] } },
      });
      expect(logged).toBe(1);
    });
  });

  describe("closeBudget (had no state check at all)", () => {
    it("refuses to close an already closed budget", async () => {
      const budget = await db.budget.create({
        data: { tenantId, companyId, period: "2026", baselineAmount: 1000, createdById: actorId },
      });
      await closeBudget(tenantId, budget.id);
      await expect(closeBudget(tenantId, budget.id)).rejects.toThrow(/already closed/i);
    });
  });

  describe("verifyEmail (a single-use token consumed with a bare update)", () => {
    it("consumes the token exactly once under concurrent clicks", async () => {
      const stamp = Date.now();
      const account = await db.publicAccount.create({
        data: {
          email: `pa-${stamp}@test.local`, username: `pa${stamp}`, passwordHash: "x",
          country: "AL", timeZone: "Europe/Tirane", accountType: "PROFESSIONAL",
          status: "EMAIL_VERIFICATION_REQUIRED",
        },
      });
      const token = `tok-${stamp}`;
      await db.emailVerificationToken.create({
        data: { publicAccountId: account.id, token, expiresAt: new Date(Date.now() + 60_000) },
      });

      const results = await Promise.allSettled([verifyEmail(token), verifyEmail(token)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const events = await db.profileAuditEvent.count({
        where: { publicAccountId: account.id, eventType: "EMAIL_VERIFIED" },
      });
      expect(events).toBe(1);

      await db.publicAccount.delete({ where: { id: account.id } }).catch(() => {});
    });
  });
});
