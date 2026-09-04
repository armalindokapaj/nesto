/**
 * Transactions, tenant context, audit and outbox — ADR-0002, ADR-0005, ADR-0006.
 *
 * Two entry points, and the choice between them is a real decision:
 *
 *   readScope(ctx, fn)  — a READ ONLY transaction. Postgres rejects a write
 *                         inside it, so a query handler that quietly mutates
 *                         something fails immediately rather than in review.
 *   unitOfWork(ctx, fn) — read-write. Collects audit entries and outbox events
 *                         and writes them in the same transaction as the
 *                         business change, which is the whole point of §20.3:
 *                         the fact and the intent to publish it commit together
 *                         or neither does.
 *
 * Both open exactly one transaction per request, not one per query. `SET LOCAL`
 * needs a transaction to be local to, and a page composing twelve widgets should
 * pay for one BEGIN/COMMIT, not twelve.
 */

import type { ExecutionContext } from "@nesto/contracts";
import { NestoError } from "@nesto/contracts";
import { canonicalize, isSupported } from "@nesto/events";
import { sha256Hex } from "@nesto/crypto";
import { db, rawClient, Prisma } from "./client";
import { scopeStorage, type DbScope } from "./scope";
import { newId } from "./id";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

export type AuditEntry = {
  action: string;
  /** The tenant the action concerned, when the actor's own context has none.
   *  A Platform Admin acting on a company is scoped to the platform, but the
   *  evidence belongs to that company's trail — the audit row records the
   *  subject, not the actor's scope. */
  tenantId?: string;
  owningCompanyId?: string;
  targetType?: string;
  targetId?: string;
  result?: "SUCCESS" | "DENIED" | "FAILED";
  reason?: string;
  /** Already redacted by data classification before it gets here (ADR-0017). */
  changes?: Record<string, unknown>;
};

export type OutboxEmit = {
  eventType: string;
  /** The aggregate's tenant. Required when the actor is platform-scoped: an
   *  event is a fact about an aggregate, and the aggregate's tenant is a
   *  property of the aggregate, not of whoever caused the change. */
  tenantId?: string;
  schemaVersion?: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  data: Record<string, unknown>;
  owningCompanyId?: string;
  projectId?: string;
  causationId?: string;
};

export type ActivityEntry = {
  verb: string;
  tenantId?: string;
  targetType: string;
  targetId: string;
  summaryKey: string;
  summaryParams?: Record<string, unknown>;
  visibility?: "COMPANY" | "PROJECT" | "SHARED_EXTERNAL";
  owningCompanyId?: string;
  projectId?: string;
};

export type UnitOfWork = {
  ctx: ExecutionContext;
  /** The scoped client. Same surface as `db`, already inside the transaction. */
  tx: TransactionalDb;
  /** Append security evidence. Written before commit, in this transaction. */
  audit(entry: AuditEntry): void;
  /** Publish a domain fact. Written to the outbox before commit. */
  emit(event: OutboxEmit): void;
  /** Add a line to the user-facing timeline. Rebuildable, unlike audit. */
  activity(entry: ActivityEntry): void;
};

type TransactionalDb = Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function contextSql(ctx: ExecutionContext): { tenant: string; platform: string } {
  return {
    tenant: ctx.tenantId ?? "",
    // The platform audience spans tenants for lifecycle work only. This does not
    // grant application-level access — §24.5 still forbids a tenant explorer —
    // it only stops RLS from blocking the operations Platform Admin does have.
    platform: ctx.audience === "PLATFORM" ? "true" : "false",
  };
}

async function applyContext(tx: TransactionalDb, ctx: ExecutionContext, readOnly: boolean): Promise<void> {
  const { tenant, platform } = contextSql(ctx);
  // `true` is the local flag: this setting dies with the transaction. Never
  // SET SESSION — a pooled connection carrying the previous request's tenant is
  // precisely the failure this design exists to prevent (§6.3).
  await (tx as unknown as { $executeRaw: typeof db.$executeRaw }).$executeRaw`
    SELECT set_config('app.tenant_id', ${tenant}, true),
           set_config('app.platform', ${platform}, true)
  `;
  if (readOnly) {
    await (tx as unknown as { $executeRawUnsafe: typeof db.$executeRawUnsafe }).$executeRawUnsafe(
      "SET TRANSACTION READ ONLY"
    );
  }
}

export type ScopeOptions = { timeoutMs?: number; maxWaitMs?: number };

/**
 * A read-only scope. Use for every query path.
 */
export async function readScope<T>(
  ctx: ExecutionContext,
  fn: (tx: TransactionalDb) => Promise<T>,
  options: ScopeOptions = {}
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      const scope: DbScope = { ctx, readOnly: true, unscoped: false };
      await applyContext(tx as TransactionalDb, ctx, true);
      // `await` inside the run callback, not around it. A PrismaPromise is lazy:
      // returning one unawaited hands the caller a promise whose query does not
      // execute until `.then`, by which point the AsyncLocalStorage frame is
      // gone and the operation looks unscoped. Awaiting here keeps the frame
      // open across every continuation the callback starts.
      return scopeStorage.run(scope, async () => await fn(tx as TransactionalDb));
    },
    { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxWait: options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS }
  );
}

/**
 * A read-write scope with audit and outbox.
 *
 * Evidence is collected during the callback and flushed just before commit, so
 * a handler that throws leaves neither a business row nor an audit row nor an
 * event claiming something happened.
 */
export async function unitOfWork<T>(
  ctx: ExecutionContext,
  fn: (uow: UnitOfWork) => Promise<T>,
  options: ScopeOptions = {}
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      const audits: AuditEntry[] = [];
      const events: OutboxEmit[] = [];
      const activities: ActivityEntry[] = [];
      const scope: DbScope = { ctx, readOnly: false, unscoped: false };

      await applyContext(tx as TransactionalDb, ctx, false);

      const uow: UnitOfWork = {
        ctx,
        tx: tx as TransactionalDb,
        audit: (entry) => audits.push(entry),
        emit: (event) => events.push(event),
        activity: (entry) => activities.push(entry),
      };

      // The flushes run inside the same AsyncLocalStorage frame as the
      // callback, because they are themselves scoped writes.
      return scopeStorage.run(scope, async () => {
        const result = await fn(uow);
        await flushAudit(tx as TransactionalDb, ctx, audits);
        await flushActivity(tx as TransactionalDb, ctx, activities);
        await flushOutbox(tx as TransactionalDb, ctx, events);
        return result;
      });
    },
    { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxWait: options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS }
  );
}

async function flushAudit(tx: TransactionalDb, ctx: ExecutionContext, entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await tx.auditEvent.createMany({
    data: entries.map((e) => {
      const row = {
        id: newId(),
        occurredAt: new Date(ctx.now),
        tenantId: e.tenantId ?? ctx.tenantId ?? null,
        owningCompanyId: e.owningCompanyId ?? ctx.activeCompanyId ?? null,
        projectId: ctx.activeProjectId ?? null,
        actorType: ctx.actorType,
        actorId: ctx.actorType === "SYSTEM" ? null : ctx.actorId,
        sessionId: ctx.sessionId ?? null,
        audience: ctx.audience,
        action: e.action,
        targetType: e.targetType ?? null,
        targetId: e.targetId ?? null,
        result: e.result ?? "SUCCESS",
        reason: e.reason ?? null,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        changes: (e.changes ?? Prisma.DbNull) as Prisma.InputJsonValue,
      };
      // The self-hash covers the row as written. Chaining is the sealing job's
      // problem, deliberately (ADR-0008).
      return { ...row, hash: sha256Hex(canonicalize(row)) };
    }),
  });
}

async function flushActivity(tx: TransactionalDb, ctx: ExecutionContext, entries: ActivityEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await tx.activityEvent.createMany({
    data: entries.map((e) => ({
      id: newId(),
      occurredAt: new Date(ctx.now),
      tenantId: (e.tenantId ?? ctx.tenantId) as string,
      owningCompanyId: e.owningCompanyId ?? ctx.activeCompanyId ?? null,
      projectId: e.projectId ?? ctx.activeProjectId ?? null,
      actorId: ctx.actorType === "SYSTEM" ? null : ctx.actorId,
      verb: e.verb,
      targetType: e.targetType,
      targetId: e.targetId,
      summaryKey: e.summaryKey,
      summaryParams: (e.summaryParams ?? Prisma.DbNull) as Prisma.InputJsonValue,
      visibility: e.visibility ?? "COMPANY",
      correlationId: ctx.correlationId,
    })),
  });
}

async function flushOutbox(tx: TransactionalDb, ctx: ExecutionContext, events: OutboxEmit[]): Promise<void> {
  if (events.length === 0) return;
  await tx.outboxEvent.createMany({
    data: events.map((e) => {
      // An event type nobody registered would dead-letter on the consumer side
      // at best, and be silently dropped at worst. Refuse it at the producer.
      if (!isSupported(e.eventType)) {
        throw new NestoError("INTERNAL_ERROR", `Event type "${e.eventType}" is not in the registry.`);
      }
      const tenantId = e.tenantId ?? ctx.tenantId;
      if (!tenantId) {
        throw new NestoError(
          "INTERNAL_ERROR",
          `Event "${e.eventType}" has no tenant. A platform-scoped actor must state the aggregate's tenantId on emit.`
        );
      }
      return {
        id: newId(),
        eventId: newId(),
        eventType: e.eventType,
        schemaVersion: e.schemaVersion ?? 1,
        tenantId,
        owningCompanyId: e.owningCompanyId ?? ctx.activeCompanyId ?? null,
        projectId: e.projectId ?? ctx.activeProjectId ?? null,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        aggregateVersion: e.aggregateVersion,
        actorType: ctx.actorType,
        actorId: ctx.actorId,
        correlationId: ctx.correlationId,
        causationId: e.causationId ?? null,
        payload: e.data as Prisma.InputJsonValue,
        status: "PENDING",
        occurredAt: new Date(ctx.now),
      };
    }),
  });
}

/**
 * Cross-tenant access, for the three callers that legitimately need it: the
 * seed, the outbox relay and the maintenance jobs. Never reachable from a
 * request path — nothing in `apps/api` imports it, and an architecture test
 * enforces that.
 */
export async function unscopedScope<T>(fn: (tx: TransactionalDb) => Promise<T>): Promise<T> {
  const ctx: ExecutionContext = {
    requestId: newId(),
    correlationId: newId(),
    actorType: "SYSTEM",
    actorId: "00000000-0000-0000-0000-000000000000",
    audience: "PLATFORM",
    locale: "en",
    now: new Date().toISOString(),
  };
  return db.$transaction(
    async (tx) => {
      await applyContext(tx as TransactionalDb, ctx, false);
      return scopeStorage.run({ ctx, readOnly: false, unscoped: true }, async () => await fn(tx as TransactionalDb));
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}

export async function disconnect(): Promise<void> {
  await rawClient.$disconnect();
}

export type { TransactionalDb };
