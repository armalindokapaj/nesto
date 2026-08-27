import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createReservation, recordUnitSale, releaseReservation } from "@/server/crm-module";
import { transitionUnitStatus, archiveUnit, restoreUnit } from "@/server/units";

// Phase 16/17 — a unit is the one record in this app where a lost update costs
// real money: two buyers, one apartment. `updateUnit` already does this
// correctly (updateMany with a version guard, throwing when count is 0); the
// sales paths next to it did not.
describe("unit sale and reservation state guards", () => {
  let tenantId: string;
  let companyId: string;
  let projectId: string;
  let actorId: string;
  let clientA: string;
  let clientB: string;
  let unitId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Unit Sale Test", slug: `unit-sale-${stamp}` } });
    tenantId = tenant.id;
    const company = await db.company.create({ data: { tenantId, name: "USC", isParent: true } });
    companyId = company.id;
    const project = await db.project.create({
      data: { tenantId, companyId, code: "US-1", name: "Sale Test Tower", status: "ON_TRACK" },
    });
    projectId = project.id;
    const actor = await db.userIdentity.create({
      data: { email: `us-${stamp}@test.local`, username: `us${stamp}`, displayName: "Sales Rep", passwordHash: "x" },
    });
    actorId = actor.id;
    await db.companyMembership.create({ data: { tenantId, userId: actorId, role: "SALES" } });
    const a = await db.client.create({ data: { tenantId, name: "Buyer A", createdById: actorId } });
    const b = await db.client.create({ data: { tenantId, name: "Buyer B", createdById: actorId } });
    clientA = a.id;
    clientB = b.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.delete({ where: { id: actorId } }).catch(() => {});
  });

  // A fresh AVAILABLE unit per test — these all mutate lifecycleStatus.
  beforeEach(async () => {
    const unit = await db.unit.create({
      data: { tenantId, companyId, projectId, code: `U-${Date.now()}${Math.floor(Math.random() * 1e5)}`, type: "APARTMENT", lifecycleStatus: "AVAILABLE" },
    });
    unitId = unit.id;
  });

  const statusOf = async () => (await db.unit.findUniqueOrThrow({ where: { id: unitId } })).lifecycleStatus;
  const activeReservations = () =>
    db.clientUnitRelationship.count({ where: { tenantId, unitId, type: "RESERVED", reservationStatus: "ACTIVE" } });
  const purchases = () => db.clientUnitRelationship.count({ where: { tenantId, unitId, type: "PURCHASED" } });

  const reserve = (clientId: string) =>
    createReservation(tenantId, { clientId, unitId, reservationDate: new Date(), salespersonId: actorId, actorId });
  const sell = (clientId: string) =>
    recordUnitSale(tenantId, { clientId, unitId, type: "PURCHASED", saleDate: new Date(), salespersonId: actorId, actorId });

  describe("reservation", () => {
    it("reserves an available unit", async () => {
      await reserve(clientA);
      expect(await statusOf()).toBe("RESERVED");
      expect(await activeReservations()).toBe(1);
    });

    it("refuses a second reservation once the unit is taken", async () => {
      await reserve(clientA);
      await expect(reserve(clientB)).rejects.toThrow();
      expect(await activeReservations()).toBe(1);
    });

    // The status read happened outside the $transaction and the write inside
    // was unconditional, so two racing requests both saw AVAILABLE, both
    // passed the check, and both wrote.
    it("lets only one of two simultaneous reservations win", async () => {
      const results = await Promise.allSettled([reserve(clientA), reserve(clientB)]);
      const won = results.filter((r) => r.status === "fulfilled");
      expect(won).toHaveLength(1);
      expect(await activeReservations()).toBe(1);
    });

    it("frees the unit again when the reservation is released", async () => {
      const rel = await reserve(clientA);
      await releaseReservation(tenantId, { relationshipId: rel.id, actorId });
      expect(await statusOf()).toBe("AVAILABLE");
      expect(await activeReservations()).toBe(0);
      await reserve(clientB);
      expect(await activeReservations()).toBe(1);
    });

    it("releases a reservation only once", async () => {
      const rel = await reserve(clientA);
      const results = await Promise.allSettled([
        releaseReservation(tenantId, { relationshipId: rel.id, actorId }),
        releaseReservation(tenantId, { relationshipId: rel.id, actorId }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });
  });

  describe("sale", () => {
    it("sells an available unit", async () => {
      await sell(clientA);
      expect(await statusOf()).toBe("SOLD");
      expect(await purchases()).toBe(1);
    });

    // recordUnitSale never read lifecycleStatus at all, so this needed no
    // concurrency whatsoever — just two clicks in sequence.
    it("refuses to sell a unit that is already sold", async () => {
      await sell(clientA);
      await expect(sell(clientB)).rejects.toThrow();
      expect(await purchases()).toBe(1);
    });

    it("lets only one of two simultaneous sales win", async () => {
      const results = await Promise.allSettled([sell(clientA), sell(clientB)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await purchases()).toBe(1);
    });

    it("converts the buyer's own reservation instead of leaving it open", async () => {
      await reserve(clientA);
      await sell(clientA);
      expect(await statusOf()).toBe("SOLD");
      expect(await activeReservations()).toBe(0);
      expect(await purchases()).toBe(1);
    });

    // The conversion was scoped to `clientId: input.clientId`, so selling to
    // someone else left the first buyer's reservation ACTIVE against a unit
    // that had just been sold out from under them.
    it("refuses to sell a unit reserved by a different client", async () => {
      await reserve(clientA);
      await expect(sell(clientB)).rejects.toThrow();
      expect(await statusOf()).toBe("RESERVED");
      expect(await activeReservations()).toBe(1);
      expect(await purchases()).toBe(0);
    });
  });

  describe("archive and restore", () => {
    // Phase 17's headline bug: archiveUnit() set lifecycleStatus: "ARCHIVED"
    // directly, so it reached an outcome UNIT_MANUAL_TRANSITIONS forbids —
    // a sold apartment could be archived out of the live unit list while the
    // client who bought it had no idea.
    it("refuses to archive a SOLD unit, the transition the table forbids", async () => {
      await sell(clientA);
      await expect(archiveUnit(tenantId, unitId, actorId)).rejects.toThrow(/Cannot move a unit from SOLD/i);
      const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.lifecycleStatus).toBe("SOLD");
      expect(unit.archivedAt).toBeNull();
    });

    it("refuses to archive a RESERVED unit too", async () => {
      await reserve(clientA);
      await expect(archiveUnit(tenantId, unitId, actorId)).rejects.toThrow(/Cannot move a unit from RESERVED/i);
      expect(await statusOf()).toBe("RESERVED");
    });

    it("still archives the states the table does allow", async () => {
      // AVAILABLE -> ARCHIVED is listed, so this must keep working as before.
      await archiveUnit(tenantId, unitId, actorId);
      const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.lifecycleStatus).toBe("ARCHIVED");
      expect(unit.archivedAt).not.toBeNull();
    });

    it("archives once, not twice", async () => {
      await archiveUnit(tenantId, unitId, actorId);
      // ARCHIVED has no legal transitions at all, so the second attempt is
      // rejected by the same table rather than by a bespoke message.
      await expect(archiveUnit(tenantId, unitId, actorId)).rejects.toThrow(/Cannot move a unit from ARCHIVED/i);
    });

    // restoreUnit resets lifecycleStatus to DRAFT, and nothing checked the
    // unit was archived first — so running it against a live SOLD unit
    // silently turned a completed sale back into an unsold draft.
    it("refuses to restore a unit that was never archived", async () => {
      await sell(clientA);
      expect(await statusOf()).toBe("SOLD");
      await expect(restoreUnit(tenantId, unitId, actorId)).rejects.toThrow(/not archived/i);
      expect(await statusOf()).toBe("SOLD");
    });

    it("restores an archived unit to draft", async () => {
      await archiveUnit(tenantId, unitId, actorId);
      await restoreUnit(tenantId, unitId, actorId);
      expect(await statusOf()).toBe("DRAFT");
    });
  });

  describe("manual status transitions", () => {
    it("still rejects a transition the lifecycle table disallows", async () => {
      await expect(transitionUnitStatus(tenantId, unitId, actorId, "SOLD")).rejects.toThrow();
    });

    // Read-then-write with no guard: both callers read AVAILABLE, both found
    // their target in the allowed list, and both wrote.
    it("lets only one of two simultaneous transitions win", async () => {
      const results = await Promise.allSettled([
        transitionUnitStatus(tenantId, unitId, actorId, "NOT_FOR_SALE"),
        transitionUnitStatus(tenantId, unitId, actorId, "COMPANY_OWNED"),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });

    it("does not let a manual transition steal a reserved unit", async () => {
      await reserve(clientA);
      await expect(transitionUnitStatus(tenantId, unitId, actorId, "NOT_FOR_SALE")).rejects.toThrow();
      expect(await statusOf()).toBe("RESERVED");
    });
  });
});
