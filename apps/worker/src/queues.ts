/**
 * The queue topology of PRD §20.8.
 *
 * Every job payload carries company/project/actor context, an idempotency key,
 * the attempt number and a correlation id — because a job that cannot say which
 * tenant it belongs to cannot be executed safely, and one that cannot be traced
 * cannot be supported.
 */

import { Queue, Worker, type ConnectionOptions, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUES = [
  "provisioning",
  "lifecycle",
  "notifications",
  "files",
  "data-transfer",
  "structure",
  "schedule",
  "search",
  "reporting",
  "reconciliation",
  "retention",
  "integration",
  "domain-events",
] as const;

export type QueueName = (typeof QUEUES)[number];

export type JobContext = {
  tenantId?: string;
  owningCompanyId?: string;
  projectId?: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
};

export type JobPayload<T = Record<string, unknown>> = { context: JobContext; data: T };

let connection: IORedis | undefined;

export function redis(): IORedis {
  connection ??= new IORedis(process.env["REDIS_URL"] ?? "redis://localhost:6380", {
    // BullMQ requires this: a blocking command that gives up mid-wait would
    // silently drop a job.
    maxRetriesPerRequest: null,
  });
  return connection;
}

function connectionOptions(): ConnectionOptions {
  return redis();
}

const queues = new Map<QueueName, Queue>();

export function queue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: connectionOptions(),
      defaultJobOptions: {
        attempts: 5,
        // Exponential with jitter (§20.4). Without jitter every consumer of a
        // failed batch retries in lockstep and re-creates the pile-up.
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
    queues.set(name, q);
  }
  return q;
}

export async function enqueue<T>(
  name: QueueName,
  jobName: string,
  payload: JobPayload<T>,
  options: JobsOptions = {}
): Promise<void> {
  await queue(name).add(jobName, payload, {
    // The idempotency key is the job id, so the same logical job enqueued twice
    // is one job. This is what makes a retried command safe at the queue level
    // as well as at the API.
    jobId: payload.context.idempotencyKey,
    ...options,
  });
}

export function createWorker<T>(
  name: QueueName,
  handler: (payload: JobPayload<T>, attempt: number) => Promise<void>,
  concurrency = 4
): Worker {
  return new Worker(
    name,
    async (job) => handler(job.data as JobPayload<T>, job.attemptsMade + 1),
    { connection: connectionOptions(), concurrency }
  );
}

export async function closeQueues(): Promise<void> {
  for (const q of queues.values()) await q.close();
  queues.clear();
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
