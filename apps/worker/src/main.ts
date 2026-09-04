/**
 * Worker entry point.
 *
 * Runs the relay, the sealer and the retention sweeps on timers, and the queue
 * consumers for everything the API hands off. One process here; in a real
 * deployment these scale independently per queue (§10 "operational load that
 * harms other domains" is one of the extraction criteria).
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { writeSync } from "node:fs";

loadEnv({ path: resolve(__dirname, "../../../.env"), quiet: true });

import { logger } from "@nesto/observability";
import { disconnect } from "@nesto/database";
import { closeQueues, createWorker } from "./queues";
import { relayOnce } from "./jobs/outbox-relay";
import { sealOnce } from "./jobs/audit-sealer";
import { sweepExpiredExports, sweepExpiredIdempotencyKeys, sweepPublishedOutbox } from "./jobs/retention";
import { registerDomainEventConsumers, dispatchDomainEvent, type IncomingEvent } from "./consumers";

const RELAY_INTERVAL_MS = 1000;
const SEAL_INTERVAL_MS = 30_000;
const RETENTION_INTERVAL_MS = 15 * 60_000;

const timers: NodeJS.Timeout[] = [];
let shuttingDown = false;

/**
 * A timer that never overlaps itself. A fixed setInterval on a job that
 * occasionally takes longer than its period stacks executions until the process
 * falls over — a failure that only appears under the load where it hurts most.
 */
function everyAfterCompletion(ms: number, name: string, run: () => Promise<unknown>): void {
  const tick = async (): Promise<void> => {
    if (shuttingDown) return;
    try {
      await run();
    } catch (error) {
      logger.error("worker.job_failed", { job: name, error: error instanceof Error ? error.message : String(error) });
    }
    if (!shuttingDown) timers.push(setTimeout(() => void tick(), ms));
  };
  void tick();
}

async function main(): Promise<void> {
  registerDomainEventConsumers();

  const eventWorker = createWorker<IncomingEvent>("domain-events", async (payload) => {
    await dispatchDomainEvent(payload);
  }, 8);

  eventWorker.on("failed", (job, error) => {
    logger.error("worker.event_failed", { jobId: job?.id, error: error.message });
  });

  everyAfterCompletion(RELAY_INTERVAL_MS, "outbox-relay", relayOnce);
  everyAfterCompletion(SEAL_INTERVAL_MS, "audit-sealer", sealOnce);
  everyAfterCompletion(RETENTION_INTERVAL_MS, "retention", async () => {
    await sweepExpiredIdempotencyKeys();
    await sweepExpiredExports();
    await sweepPublishedOutbox();
  });

  logger.info("worker.started", { queues: ["domain-events"], jobs: ["outbox-relay", "audit-sealer", "retention"] });

  const shutdown = async (signal: string): Promise<void> => {
    shuttingDown = true;
    logger.info("worker.stopping", { signal });
    for (const t of timers) clearTimeout(t);
    await eventWorker.close();
    await closeQueues();
    await disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((error: unknown) => {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  writeSync(2, `worker.bootstrap_failed\n${detail}\n`);
  process.exit(1);
});
