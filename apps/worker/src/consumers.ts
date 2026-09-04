/**
 * Domain event consumers — PRD §20.4.
 *
 * The contract every consumer follows, in order:
 *   claim in the inbox → establish context → do local work → record checkpoint.
 *
 * The claim is what makes at-least-once delivery safe. A duplicate is
 * short-circuited before the handler runs, so a handler does not have to be
 * idempotent against duplicates — only re-runnable to completion after a
 * partial failure, which is a much weaker thing to ask.
 *
 * A consumer never writes the source domain's tables (§20.4). It projects, it
 * notifies, it reconciles — and if it needs protected detail it asks the owner
 * through a query contract under its own identity.
 */

import { unscopedScope, newId } from "@nesto/database";
import { logger } from "@nesto/observability";
import type { JobPayload } from "./queues";

export type IncomingEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  tenantId: string;
  owningCompanyId: string | null;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  actor: { type: string; id: string };
  correlationId: string;
  causationId: string | null;
  data: Record<string, unknown>;
};

export type ConsumerHandler = (event: IncomingEvent) => Promise<void>;

const consumers = new Map<string, { name: string; handler: ConsumerHandler }[]>();

export function on(eventType: string, name: string, handler: ConsumerHandler): void {
  const list = consumers.get(eventType) ?? [];
  list.push({ name, handler });
  consumers.set(eventType, list);
}

export async function dispatchDomainEvent(payload: JobPayload<IncomingEvent>): Promise<void> {
  const event = payload.data;
  const registered = consumers.get(event.eventType) ?? [];
  if (registered.length === 0) return;

  for (const { name, handler } of registered) {
    const claimed = await claim(name, event);
    if (!claimed) continue;

    try {
      await handler(event);
      await complete(name, event.eventId);
    } catch (error) {
      await fail(name, event.eventId, error);
      throw error;
    }
  }
}

/** Returns false when this consumer has already seen the event. */
async function claim(consumer: string, event: IncomingEvent): Promise<boolean> {
  return unscopedScope(async (tx) => {
    const existing = await tx.inboxMessage.findUnique({
      where: { consumer_eventId: { consumer, eventId: event.eventId } },
    });
    if (existing?.status === "PROCESSED") return false;
    if (existing) {
      await tx.inboxMessage.update({
        where: { consumer_eventId: { consumer, eventId: event.eventId } },
        data: { attempts: { increment: 1 }, status: "CLAIMED" },
      });
      return true;
    }
    await tx.inboxMessage.create({
      data: {
        id: newId(),
        consumer,
        eventId: event.eventId,
        eventType: event.eventType,
        tenantId: event.tenantId,
        status: "CLAIMED",
        attempts: 1,
      },
    });
    return true;
  });
}

async function complete(consumer: string, eventId: string): Promise<void> {
  await unscopedScope(async (tx) => {
    await tx.inboxMessage.update({
      where: { consumer_eventId: { consumer, eventId } },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    await tx.consumerCheckpoint.upsert({
      where: { consumer },
      create: { id: newId(), consumer, lastEventId: eventId, lastOccurredAt: new Date(), processedCount: 1 },
      update: { lastEventId: eventId, lastOccurredAt: new Date(), processedCount: { increment: 1 } },
    });
  });
}

async function fail(consumer: string, eventId: string, error: unknown): Promise<void> {
  await unscopedScope((tx) =>
    tx.inboxMessage.update({
      where: { consumer_eventId: { consumer, eventId } },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown" },
    })
  );
}

/**
 * Registered here rather than by side-effecting imports scattered across the
 * codebase, so the full set of consumers is visible in one place — which is
 * what a "registered consumers" list in §20.1 has to mean if it is to be
 * reviewable.
 */
export function registerDomainEventConsumers(): void {
  on("company.lifecycle.changed.v1", "activity-projection", async (event) => {
    logger.info("consumer.company_lifecycle", {
      tenantId: event.tenantId,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
    });
  });
}

export function resetConsumersForTest(): void {
  consumers.clear();
}
