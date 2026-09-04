/**
 * The negative isolation harness — PRD §26.2, Phase 0.
 *
 * Every assertion here is of the form "this must NOT be possible". A suite that
 * only proves the happy path proves nothing about a multi-tenant system: the
 * defect that matters is the one where a query *succeeds* and returns somebody
 * else's data.
 *
 * Runs against real Postgres as nesto_app, with RLS forced. Both barriers are
 * exercised — the application scope and the database policy — and several tests
 * deliberately disable the first to confirm the second still holds.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../client";
import { readScope, unitOfWork, unscopedScope, disconnect } from "../unit-of-work";
import { newId } from "../id";
import { createTenantFixture, contextFor, type Fixture } from "./fixtures";

let alpha: Fixture;
let beta: Fixture;

beforeAll(async () => {
  alpha = await createTenantFixture("Alpha");
  beta = await createTenantFixture("Beta");
});

afterAll(async () => {
  await disconnect();
});

describe("ISO-01 — Company A cannot read Company B", () => {
  it("lists only its own companies", async () => {
    const rows = await readScope(alpha.ctx, (tx) => tx.company.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).toEqual([alpha.companyId]);
  });

  it("cannot fetch the other tenant's company by its exact id", async () => {
    const found = await readScope(alpha.ctx, (tx) =>
      tx.company.findFirst({ where: { id: beta.companyId } })
    );
    expect(found).toBeNull();
  });

  it("still returns nothing when the caller names the other tenant explicitly", async () => {
    // The scope is merged with AND, so a hand-written tenantId cannot override
    // it — both predicates have to hold and they contradict.
    const found = await readScope(alpha.ctx, (tx) =>
      tx.company.findMany({ where: { tenantId: beta.tenantId } })
    );
    expect(found).toHaveLength(0);
  });

  it("is still blocked by the database when the application scope is bypassed", async () => {
    // This is the second barrier on its own: raw SQL, no scope injection, an
    // explicit cross-tenant predicate. RLS returns zero rows.
    const rows = await readScope(alpha.ctx, (tx) =>
      tx.$queryRaw<{ id: string }[]>`SELECT id FROM foundation.company WHERE id = ${beta.companyId}::uuid`
    );
    expect(rows).toHaveLength(0);
  });

  it("does not leak the other tenant through a count", async () => {
    // §26.2: a count must not reveal that a record exists.
    const total = await readScope(alpha.ctx, (tx) => tx.company.count());
    expect(total).toBe(1);
  });
});

describe("ISO-02 — Company A cannot create a record referencing Company B", () => {
  it("refuses a write that names a foreign tenant, loudly", async () => {
    // Not silently corrected: naming another tenant is the signature of a
    // cross-tenant reference attack and has to be visible (threat T2).
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.branch.create({
          data: {
            id: newId(),
            tenantId: beta.tenantId,
            owningCompanyId: alpha.companyId,
            name: "Smuggled",
            code: "SMG",
            countryCode: "AL",
            createdBy: alpha.userId,
            updatedBy: alpha.userId,
          },
        })
      )
    ).rejects.toThrow(/Refusing to write Branch with tenantId/);
  });

  it("refuses a write that names a foreign company", async () => {
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.branch.create({
          data: {
            id: newId(),
            tenantId: alpha.tenantId,
            owningCompanyId: beta.companyId,
            name: "Smuggled",
            code: "SMG2",
            countryCode: "AL",
            createdBy: alpha.userId,
            updatedBy: alpha.userId,
          },
        })
      )
    ).rejects.toThrow(/Refusing to write Branch with owningCompanyId/);
  });

  it("stamps the scope automatically when the caller omits it", async () => {
    const id = newId();
    await unitOfWork(alpha.ctx, (uow) =>
      uow.tx.branch.create({
        data: {
          id,
          name: "Head office",
          code: `HO-${id.slice(-8)}`,
          countryCode: "AL",
          createdBy: alpha.userId,
          updatedBy: alpha.userId,
        } as never,
      })
    );
    const row = await readScope(alpha.ctx, (tx) => tx.branch.findFirst({ where: { id } }));
    expect(row?.tenantId).toBe(alpha.tenantId);
    expect(row?.owningCompanyId).toBe(alpha.companyId);
  });
});

describe("ISO-03 — Company A cannot update or delete Company B's records", () => {
  it("updates nothing when targeting the other tenant's row by id", async () => {
    const result = await unitOfWork(alpha.ctx, (uow) =>
      uow.tx.company.updateMany({
        where: { id: beta.companyId },
        data: { displayName: "Taken over" },
      })
    );
    expect(result.count).toBe(0);

    const untouched = await readScope(beta.ctx, (tx) =>
      tx.company.findFirst({ where: { id: beta.companyId } })
    );
    expect(untouched?.displayName).not.toBe("Taken over");
  });

  it("cannot delete across the boundary", async () => {
    const result = await unitOfWork(alpha.ctx, (uow) =>
      uow.tx.company.deleteMany({ where: { id: beta.companyId } })
    );
    expect(result.count).toBe(0);
  });

  it("reports a single-row update of a foreign id as not found, not as success", async () => {
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.company.update({ where: { id: beta.companyId }, data: { displayName: "Taken over" } })
      )
    ).rejects.toThrow();
  });
});

describe("scope is mandatory", () => {
  it("refuses any query issued with no execution context at all", async () => {
    await expect(db.company.findMany()).rejects.toThrow(/ran with no execution context/);
  });

  it("refuses a write inside a read-only scope", async () => {
    await expect(
      readScope(alpha.ctx, (tx) =>
        tx.branch.create({
          data: {
            id: newId(),
            name: "x",
            code: "x",
            countryCode: "AL",
            createdBy: alpha.userId,
            updatedBy: alpha.userId,
          } as never,
        })
      )
    ).rejects.toThrow(/read-only scope/);
  });

  it("has the database refuse the write too, if the application check were removed", async () => {
    // Belt and braces: SET TRANSACTION READ ONLY means Postgres rejects it
    // regardless of what the extension does.
    await expect(
      readScope(alpha.ctx, (tx) =>
        tx.$executeRawUnsafe(`UPDATE foundation.company SET "displayName" = 'x' WHERE id = '${alpha.companyId}'`)
      )
    ).rejects.toThrow(/read-only transaction/i);
  });
});

describe("audit evidence is append-only (ADR-0008)", () => {
  it("writes evidence in the same transaction as the change", async () => {
    const branchId = newId();
    await unitOfWork(alpha.ctx, async (uow) => {
      await uow.tx.branch.create({
        data: {
          id: branchId,
          name: "Audited",
          code: `AU-${branchId.slice(-8)}`,
          countryCode: "AL",
          createdBy: alpha.userId,
          updatedBy: alpha.userId,
        } as never,
      });
      uow.audit({ action: "branch.created", targetType: "BRANCH", targetId: branchId });
    });

    const evidence = await readScope(alpha.ctx, (tx) =>
      tx.auditEvent.findFirst({ where: { targetId: branchId } })
    );
    expect(evidence?.action).toBe("branch.created");
    expect(evidence?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cannot be updated, because no role holds the privilege", async () => {
    const row = await readScope(alpha.ctx, (tx) => tx.auditEvent.findFirst());
    expect(row).not.toBeNull();
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.$executeRawUnsafe(`UPDATE audit.audit_event SET action = 'tampered' WHERE id = '${row!.id}'`)
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("cannot be deleted, even by the actor who created it", async () => {
    const row = await readScope(alpha.ctx, (tx) => tx.auditEvent.findFirst());
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.$executeRawUnsafe(`DELETE FROM audit.audit_event WHERE id = '${row!.id}'`)
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("allows only the sealing job's single column to be stamped", async () => {
    const row = await readScope(alpha.ctx, (tx) => tx.auditEvent.findFirst());
    // UPDATE("sealId") is granted; UPDATE(anything else) is not.
    await expect(
      unitOfWork(alpha.ctx, (uow) =>
        uow.tx.$executeRawUnsafe(`UPDATE audit.audit_event SET "reason" = 'x' WHERE id = '${row!.id}'`)
      )
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("the outbox commits with the business change (ADR-0006)", () => {
  it("writes the event in the same transaction", async () => {
    const companyId = alpha.companyId;
    await unitOfWork(alpha.ctx, async (uow) => {
      await uow.tx.company.update({ where: { id: companyId }, data: { city: "Tiranë" } });
      uow.emit({
        eventType: "company.lifecycle.changed.v1",
        aggregateType: "COMPANY",
        aggregateId: companyId,
        aggregateVersion: 1,
        data: { companyId, from: "ACTIVE", to: "ACTIVE", effectiveAt: new Date().toISOString() },
      });
    });

    const events = await readScope(alpha.ctx, (tx) =>
      tx.outboxEvent.findMany({ where: { aggregateId: companyId } })
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("PENDING");
  });

  it("leaves neither the change, nor the evidence, nor the event when the handler throws", async () => {
    const branchId = newId();
    await expect(
      unitOfWork(alpha.ctx, async (uow) => {
        await uow.tx.branch.create({
          data: {
            id: branchId,
            name: "Doomed",
            code: `DM-${branchId.slice(-8)}`,
            countryCode: "AL",
            createdBy: alpha.userId,
            updatedBy: alpha.userId,
          } as never,
        });
        uow.audit({ action: "branch.created", targetType: "BRANCH", targetId: branchId });
        uow.emit({
          eventType: "company.lifecycle.changed.v1",
          aggregateType: "COMPANY",
          aggregateId: branchId,
          aggregateVersion: 1,
          data: {},
        });
        throw new Error("business rule failed after the writes");
      })
    ).rejects.toThrow("business rule failed");

    const [branch, evidence, event] = await readScope(alpha.ctx, async (tx) => [
      await tx.branch.findFirst({ where: { id: branchId } }),
      await tx.auditEvent.findFirst({ where: { targetId: branchId } }),
      await tx.outboxEvent.findFirst({ where: { aggregateId: branchId } }),
    ]);
    expect(branch).toBeNull();
    expect(evidence).toBeNull();
    expect(event).toBeNull();
  });

  it("refuses an event type nobody registered", async () => {
    await expect(
      unitOfWork(alpha.ctx, async (uow) => {
        uow.emit({
          eventType: "made.up.thing.v1",
          aggregateType: "X",
          aggregateId: newId(),
          aggregateVersion: 1,
          data: {},
        });
      })
    ).rejects.toThrow(/not in the registry/);
  });
});

describe("the tenant GUC is transaction-local (threat T15)", () => {
  it("does not leak to the next operation on the same pooled connection", async () => {
    await readScope(alpha.ctx, async (tx) => {
      const [row] = await tx.$queryRaw<{ t: string | null }[]>`SELECT public.nesto_current_tenant()::text AS t`;
      expect(row?.t).toBe(alpha.tenantId);
    });

    // A fresh scope on a connection that may well be the same physical one.
    await readScope(beta.ctx, async (tx) => {
      const [row] = await tx.$queryRaw<{ t: string | null }[]>`SELECT public.nesto_current_tenant()::text AS t`;
      expect(row?.t).toBe(beta.tenantId);
    });
  });

  it("is unset outside any transaction, so an escaped query sees nothing", async () => {
    const rows = await unscopedScope((tx) =>
      tx.$queryRaw<{ t: string | null }[]>`SELECT current_setting('app.tenant_id', true) AS t`
    );
    expect(rows[0]?.t === null || rows[0]?.t === "").toBe(true);
  });
});
