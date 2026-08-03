import "server-only";
import { db } from "@/lib/db";
import type { ActorSnapshot } from "@/lib/actor-snapshot";

// Audit 2 §5 "Cross-Module Interaction Through Domain Events" — reference
// implementation for the Contract Approved -> Finance Structure -> Payment
// Recorded slice. `emitDomainEvent` is called inside the SAME db.$transaction
// as the state change that raised it (transactional outbox — the event can
// never be lost even if dispatch crashes right after commit); the caller
// then calls `dispatchDomainEvents` once the transaction has committed.
//
// There is no background worker/queue anywhere in this app yet, so "dispatch"
// here means "run registered handlers in-process, now." The PENDING/FAILED
// rows left on DomainEvent are exactly what a future worker would sweep and
// retry, without any schema change — this table is that worker's contract,
// even though the worker itself doesn't exist yet.

export type DomainEventType = "ContractApproved" | "PaymentRecorded" | "DocumentRevisionSubmitted" | "DocumentRevisionApproved";

// PRD_18 §11 context envelope. All optional — a caller that omits `context`
// entirely still works exactly as before (existing rows/behavior unchanged).
export type DomainEventContext = {
  correlationId?: string;
  causationId?: string;
  actorUserId?: string;
  actorSnapshot?: ActorSnapshot;
  sourceModule?: string;
  sourceRecordId?: string;
  owningCompanyId?: string;
  projectId?: string;
  confidentiality?: string;
};

type HandlerEvent = { id: string; tenantId: string } & DomainEventContext;

type Handler = (payload: Record<string, unknown>, event: HandlerEvent) => Promise<void>;

const handlers = new Map<DomainEventType, Handler[]>();
let handlersRegistered = false;

export function registerDomainEventHandler(type: DomainEventType, handler: Handler) {
  const list = handlers.get(type) ?? [];
  list.push(handler);
  handlers.set(type, list);
}

// Handlers self-register via side-effecting imports. Loaded lazily (rather
// than imported at module scope) to avoid a circular import between this
// file and the domain modules that both emit events and react to them.
async function ensureHandlersRegistered() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  await import("@/server/contract-lifecycle-reactions");
  await import("@/server/document-lifecycle-reactions");
}

/** Call inside a db.$transaction. Returns the event id to dispatch after commit. */
export async function emitDomainEvent(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  type: DomainEventType,
  payload: Record<string, unknown>,
  context?: DomainEventContext
): Promise<string> {
  const event = await tx.domainEvent.create({
    data: {
      tenantId,
      type,
      payload: JSON.stringify(payload),
      correlationId: context?.correlationId,
      causationId: context?.causationId,
      actorUserId: context?.actorUserId,
      actorSnapshot: context?.actorSnapshot ? JSON.stringify(context.actorSnapshot) : undefined,
      sourceModule: context?.sourceModule,
      sourceRecordId: context?.sourceRecordId,
      owningCompanyId: context?.owningCompanyId,
      projectId: context?.projectId,
      confidentiality: context?.confidentiality,
    },
  });
  // A root event correlates with itself when the caller didn't supply one
  // (e.g. because it's not reacting to another event).
  if (!context?.correlationId) {
    await tx.domainEvent.update({ where: { id: event.id }, data: { correlationId: event.id } });
  }
  return event.id;
}

/**
 * Call once the transaction that emitted these events has committed.
 * Idempotent: an event already marked PROCESSED is skipped, so a duplicate
 * dispatch call (e.g. a future retry sweep re-processing the same id) is a
 * no-op rather than a double-reaction.
 */
export async function dispatchDomainEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await ensureHandlersRegistered();

  for (const id of eventIds) {
    const event = await db.domainEvent.findUnique({ where: { id } });
    if (!event || event.status === "PROCESSED") continue;

    const list = handlers.get(event.type as DomainEventType) ?? [];
    try {
      const payload = JSON.parse(event.payload);
      const handlerEvent: HandlerEvent = {
        id: event.id,
        tenantId: event.tenantId,
        correlationId: event.correlationId ?? undefined,
        causationId: event.causationId ?? undefined,
        actorUserId: event.actorUserId ?? undefined,
        actorSnapshot: event.actorSnapshot ? JSON.parse(event.actorSnapshot) : undefined,
        sourceModule: event.sourceModule ?? undefined,
        sourceRecordId: event.sourceRecordId ?? undefined,
        owningCompanyId: event.owningCompanyId ?? undefined,
        projectId: event.projectId ?? undefined,
        confidentiality: event.confidentiality ?? undefined,
      };
      for (const handler of list) {
        await handler(payload, handlerEvent);
      }
      await db.domainEvent.update({ where: { id }, data: { status: "PROCESSED", processedAt: new Date() } });
    } catch (err) {
      await db.domainEvent.update({
        where: { id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }
}
