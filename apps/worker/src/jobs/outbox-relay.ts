/**
 * The outbox relay — PRD §20.3, ADR-0006.
 *
 * Claims pending rows, publishes them, marks them published. Delivery is
 * at-least-once by design: the alternative, marking published before the
 * publish succeeds, is at-most-once and loses events on a crash. Consumers are
 * idempotent (the inbox), so duplicates are the cheap failure and loss is not.
 *
 * The claim uses `FOR UPDATE SKIP LOCKED`, which is what lets several relay
 * instances run without coordinating and without ever handing the same row to
 * two of them.
 */

import { isSupported } from "@nesto/events";
import { unscopedScope, newId } from "@nesto/database";
import { logger, outboxDeadLettered, outboxLag, outboxPublished } from "@nesto/observability";
import { enqueue } from "../queues";

import { isExhausted, nextAttemptDelayMs } from "./backoff";

const BATCH_SIZE = 100;

type Claimed = {
  id: string;
  eventId: string;
  eventType: string;
  schemaVersion: number;
  tenantId: string;
  owningCompanyId: string | null;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  actorType: string;
  actorId: string;
  correlationId: string;
  causationId: string | null;
  payload: unknown;
  occurredAt: Date;
  attempts: number;
};

export async function relayOnce(): Promise<{ published: number; failed: number }> {
  const claimed = await unscopedScope(async (tx) =>
    tx.$queryRaw<Claimed[]>`
      WITH claimed AS (
        SELECT id
        FROM integration.outbox_event
        WHERE status IN ('PENDING', 'FAILED')
          AND "nextAttemptAt" <= now()
        ORDER BY "occurredAt"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE integration.outbox_event o
      SET status = 'PUBLISHING'
      FROM claimed
      WHERE o.id = claimed.id
      RETURNING o.id, o."eventId", o."eventType", o."schemaVersion", o."tenantId",
                o."owningCompanyId", o."projectId", o."aggregateType", o."aggregateId",
                o."aggregateVersion", o."actorType", o."actorId", o."correlationId",
                o."causationId", o.payload, o."occurredAt", o.attempts
    `
  );

  let published = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      // An unregistered type is a producer bug. It dead-letters rather than
      // being dropped, because §20.2 forbids silently ignoring one.
      if (!isSupported(row.eventType)) {
        await deadLetter(row, "UNREGISTERED_EVENT_TYPE");
        failed += 1;
        continue;
      }

      await enqueue("domain-events", row.eventType, {
        context: {
          tenantId: row.tenantId,
          owningCompanyId: row.owningCompanyId ?? undefined,
          projectId: row.projectId ?? undefined,
          actorId: row.actorId,
          correlationId: row.correlationId,
          // The event id is the job id, so a relay retry after a crash between
          // enqueue and mark-published does not create a second job.
          idempotencyKey: row.eventId,
        },
        data: {
          eventId: row.eventId,
          eventType: row.eventType,
          schemaVersion: row.schemaVersion,
          occurredAt: row.occurredAt.toISOString(),
          tenantId: row.tenantId,
          owningCompanyId: row.owningCompanyId,
          projectId: row.projectId,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          aggregateVersion: row.aggregateVersion,
          actor: { type: row.actorType, id: row.actorId },
          correlationId: row.correlationId,
          causationId: row.causationId,
          data: row.payload,
        },
      });

      await unscopedScope((tx) =>
        tx.outboxEvent.update({
          where: { id: row.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        })
      );

      outboxLag(Date.now() - row.occurredAt.getTime(), { eventType: row.eventType });
      outboxPublished({ eventType: row.eventType });
      published += 1;
    } catch (error) {
      failed += 1;
      const attempts = row.attempts + 1;
      if (isExhausted(attempts)) {
        await deadLetter(row, error instanceof Error ? error.message : "unknown");
      } else {
        const delayMs = nextAttemptDelayMs(attempts);
        await unscopedScope((tx) =>
          tx.outboxEvent.update({
            where: { id: row.id },
            data: {
              status: "FAILED",
              attempts,
              nextAttemptAt: new Date(Date.now() + delayMs),
              lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown",
            },
          })
        );
      }
    }
  }

  if (published || failed) logger.info("outbox.relay", { published, failed });
  return { published, failed };
}

async function deadLetter(row: Claimed, failureClass: string): Promise<void> {
  await unscopedScope(async (tx) => {
    await tx.deadLetter.create({
      data: {
        id: newId(),
        kind: "OUTBOX_EVENT",
        eventId: row.eventId,
        eventType: row.eventType,
        tenantId: row.tenantId,
        // The envelope is preserved so a replay has everything it needs, and
        // nothing extra: §20.8 requires a dead-letter dashboard to be safe to
        // look at, so the payload stays inside the row and out of the log.
        envelope: {
          eventId: row.eventId,
          eventType: row.eventType,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          aggregateVersion: row.aggregateVersion,
        },
        failureClass,
        diagnosticRef: row.correlationId,
        attempts: row.attempts + 1,
        firstFailedAt: row.occurredAt,
        lastFailedAt: new Date(),
        status: "OPEN",
      },
    });
    await tx.outboxEvent.update({
      where: { id: row.id },
      data: { status: "DEAD_LETTERED", attempts: row.attempts + 1, lastError: failureClass },
    });
  });
  outboxDeadLettered({ eventType: row.eventType, failureClass });
  logger.error("outbox.dead_lettered", {
    eventId: row.eventId,
    eventType: row.eventType,
    failureClass,
    correlationId: row.correlationId,
  });
}
