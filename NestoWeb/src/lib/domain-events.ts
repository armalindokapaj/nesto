import "server-only";
import { db } from "@/lib/db";

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

export type DomainEventType = "ContractApproved" | "PaymentRecorded";

type Handler = (payload: Record<string, unknown>, event: { id: string; tenantId: string }) => Promise<void>;

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
}

/** Call inside a db.$transaction. Returns the event id to dispatch after commit. */
export async function emitDomainEvent(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  type: DomainEventType,
  payload: Record<string, unknown>
): Promise<string> {
  const event = await tx.domainEvent.create({
    data: { tenantId, type, payload: JSON.stringify(payload) },
  });
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
      for (const handler of list) {
        await handler(payload, { id: event.id, tenantId: event.tenantId });
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
