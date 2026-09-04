/**
 * The outbox and inbox contract — PRD §20.3–§20.6, ADR-0006.
 *
 * Runs against real Postgres and real Redis. The properties under test are the
 * ones that only show up under failure: a duplicate delivery, a crash between
 * enqueue and mark-published, an event type nobody registered.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { unitOfWork, unscopedScope, readScope, newId, disconnect } from "@nesto/database";
import type { ExecutionContext } from "@nesto/contracts";
import { relayOnce } from "../jobs/outbox-relay";
import { sealOnce, verifyChain } from "../jobs/audit-sealer";
import { dispatchDomainEvent, on, resetConsumersForTest, type IncomingEvent } from "../consumers";
import { queue, closeQueues } from "../queues";

let tenantId: string;
let companyId: string;
let ctx: ExecutionContext;

beforeAll(async () => {
  tenantId = newId();
  companyId = newId();
  const userId = newId();

  await unscopedScope(async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, name: "Outbox Test", createdBy: userId, updatedBy: userId } });
    await tx.company.create({
      data: {
        id: companyId, tenantId, legalName: "Outbox sh.p.k.", displayName: "Outbox",
        slug: `outbox-${Date.now()}`, countryCode: "AL", lifecycleStatus: "ACTIVE",
        createdBy: userId, updatedBy: userId,
      },
    });
  });

  ctx = {
    requestId: newId(), correlationId: newId(), actorType: "USER", actorId: userId,
    audience: "COMPANY", tenantId, activeCompanyId: companyId, locale: "en",
    now: new Date().toISOString(),
  };

  await queue("domain-events").obliterate({ force: true });
});

afterAll(async () => {
  await queue("domain-events").obliterate({ force: true });
  await closeQueues();
  await disconnect();
});

beforeEach(() => resetConsumersForTest());

async function emitOne(): Promise<string> {
  const aggregateId = newId();
  await unitOfWork(ctx, async (uow) => {
    uow.emit({
      eventType: "company.lifecycle.changed.v1",
      aggregateType: "COMPANY",
      aggregateId,
      aggregateVersion: 1,
      data: { companyId: aggregateId, from: "DRAFT", to: "ACTIVE", effectiveAt: new Date().toISOString() },
    });
  });
  return aggregateId;
}

describe("the relay", () => {
  it("publishes a pending event and marks it published", async () => {
    const aggregateId = await emitOne();
    const result = await relayOnce();
    expect(result.published).toBeGreaterThanOrEqual(1);

    const row = await readScope(ctx, (tx) => tx.outboxEvent.findFirst({ where: { aggregateId } }));
    expect(row?.status).toBe("PUBLISHED");
    expect(row?.publishedAt).not.toBeNull();
  });

  it("does not re-publish what it already published", async () => {
    await emitOne();
    await relayOnce();
    const second = await relayOnce();
    expect(second.published).toBe(0);
  });

  it("dead-letters an unregistered event type instead of dropping it", async () => {
    // §20.2: an unsupported version goes to controlled failure, never silent
    // ignore. The producer refuses one, so this is written straight to the
    // table to exercise the relay's own guard.
    const aggregateId = newId();
    const eventId = newId();
    await unscopedScope((tx) =>
      tx.outboxEvent.create({
        data: {
          id: newId(), eventId, eventType: "ghost.thing.happened.v9", schemaVersion: 9,
          tenantId, aggregateType: "GHOST", aggregateId, aggregateVersion: 1,
          actorType: "SYSTEM", actorId: newId(), correlationId: newId(),
          payload: {}, status: "PENDING", occurredAt: new Date(),
        },
      })
    );

    await relayOnce();

    const [row, dead] = await unscopedScope(async (tx) => [
      await tx.outboxEvent.findFirst({ where: { eventId } }),
      await tx.deadLetter.findFirst({ where: { eventId } }),
    ]);
    expect(row?.status).toBe("DEAD_LETTERED");
    expect(dead?.failureClass).toBe("UNREGISTERED_EVENT_TYPE");
  });

  it("uses the event id as the job id, so a relay retry cannot double-enqueue", async () => {
    const aggregateId = await emitOne();
    const row = await readScope(ctx, (tx) => tx.outboxEvent.findFirst({ where: { aggregateId } }));
    await relayOnce();
    const job = await queue("domain-events").getJob(row!.eventId);
    expect(job).toBeDefined();
    expect(job?.id).toBe(row!.eventId);
  });
});

describe("the inbox (§20.4)", () => {
  function event(): IncomingEvent {
    return {
      eventId: newId(), eventType: "company.lifecycle.changed.v1", schemaVersion: 1,
      occurredAt: new Date().toISOString(), tenantId, owningCompanyId: companyId, projectId: null,
      aggregateType: "COMPANY", aggregateId: companyId, aggregateVersion: 1,
      actor: { type: "USER", id: ctx.actorId }, correlationId: newId(), causationId: null,
      data: {},
    };
  }

  it("runs a handler once for a duplicate delivery", async () => {
    // At-least-once is the delivery guarantee, so this is the property that
    // makes it safe rather than merely tolerable.
    let calls = 0;
    on("company.lifecycle.changed.v1", "count-consumer", async () => { calls += 1; });

    const e = event();
    const payload = { context: { tenantId, actorId: ctx.actorId, correlationId: e.correlationId, idempotencyKey: e.eventId }, data: e };
    await dispatchDomainEvent(payload);
    await dispatchDomainEvent(payload);
    await dispatchDomainEvent(payload);

    expect(calls).toBe(1);
  });

  it("records a checkpoint after a successful handler", async () => {
    on("company.lifecycle.changed.v1", "checkpoint-consumer", async () => {});
    const e = event();
    await dispatchDomainEvent({ context: { tenantId, actorId: ctx.actorId, correlationId: e.correlationId, idempotencyKey: e.eventId }, data: e });

    const checkpoint = await unscopedScope((tx) =>
      tx.consumerCheckpoint.findUnique({ where: { consumer: "checkpoint-consumer" } })
    );
    expect(checkpoint?.lastEventId).toBe(e.eventId);
  });

  it("marks the claim failed and rethrows, so the queue retries", async () => {
    on("company.lifecycle.changed.v1", "failing-consumer", async () => {
      throw new Error("downstream unavailable");
    });
    const e = event();
    await expect(
      dispatchDomainEvent({ context: { tenantId, actorId: ctx.actorId, correlationId: e.correlationId, idempotencyKey: e.eventId }, data: e })
    ).rejects.toThrow("downstream unavailable");

    const claim = await unscopedScope((tx) =>
      tx.inboxMessage.findUnique({ where: { consumer_eventId: { consumer: "failing-consumer", eventId: e.eventId } } })
    );
    expect(claim?.status).toBe("FAILED");
  });

  it("lets a retried event through after a failure, rather than treating it as a duplicate", async () => {
    let attempts = 0;
    on("company.lifecycle.changed.v1", "recovering-consumer", async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient");
    });
    const e = event();
    const payload = { context: { tenantId, actorId: ctx.actorId, correlationId: e.correlationId, idempotencyKey: e.eventId }, data: e };

    await expect(dispatchDomainEvent(payload)).rejects.toThrow("transient");
    await dispatchDomainEvent(payload);
    expect(attempts).toBe(2);
  });

  it("fans one event out to every registered consumer", async () => {
    const seen: string[] = [];
    on("company.lifecycle.changed.v1", "fan-a", async () => { seen.push("a"); });
    on("company.lifecycle.changed.v1", "fan-b", async () => { seen.push("b"); });
    const e = event();
    await dispatchDomainEvent({ context: { tenantId, actorId: ctx.actorId, correlationId: e.correlationId, idempotencyKey: e.eventId }, data: e });
    expect(seen.sort()).toEqual(["a", "b"]);
  });
});

describe("the audit chain (ADR-0008)", () => {
  it("seals events and verifies", async () => {
    await unitOfWork(ctx, async (uow) => {
      uow.audit({ action: "test.one", targetType: "TEST", targetId: newId() });
      uow.audit({ action: "test.two", targetType: "TEST", targetId: newId() });
    });

    await sealOnce();
    expect(await verifyChain(tenantId)).toEqual({ ok: true });
  });

  it("chains each seal to the previous one", async () => {
    await unitOfWork(ctx, async (uow) => uow.audit({ action: "test.three", targetType: "TEST", targetId: newId() }));
    await sealOnce();

    const seals = await unscopedScope((tx) =>
      tx.auditChainSeal.findMany({ where: { tenantId }, orderBy: { sealedAt: "asc" } })
    );
    expect(seals.length).toBeGreaterThanOrEqual(2);
    expect(seals[1]?.previousSealHash).toBe(seals[0]?.rollingHash);
  });

  it("detects a deleted event", async () => {
    // The property the whole design exists for. Deleting a covered event is
    // impossible through the application — no role holds DELETE — so the owner
    // connection is used here to simulate someone with direct database access.
    await unitOfWork(ctx, async (uow) => uow.audit({ action: "test.four", targetType: "TEST", targetId: newId() }));
    await sealOnce();

    const victim = await unscopedScope((tx) =>
      tx.auditEvent.findFirst({ where: { tenantId, action: "test.four" } })
    );
    expect(victim).not.toBeNull();

    const { Client } = await import("pg");
    const owner = new Client({ connectionString: process.env["DATABASE_URL_DIRECT"] });
    await owner.connect();
    await owner.query("DELETE FROM audit.audit_event WHERE id = $1", [victim!.id]);
    await owner.end();

    const result = await verifyChain(tenantId);
    expect(result.ok).toBe(false);
    expect(result.brokenSealId).toBeDefined();
  });

  it("does not seal the same event twice", async () => {
    const before = await unscopedScope((tx) => tx.auditChainSeal.count({ where: { tenantId } }));
    await sealOnce();
    const after = await unscopedScope((tx) => tx.auditChainSeal.count({ where: { tenantId } }));
    expect(after).toBe(before);
  });
});
