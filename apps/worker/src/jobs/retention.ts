/**
 * Retention sweeps — PRD §11.10, and the retention matrix in
 * docs/requirements/retention-legal-hold.csv.
 *
 * Only the classes that are safe to purge automatically are here. Anything with
 * business meaning — an issued document, a posted entry, a submitted bid, a
 * company's data after lock — is never deleted by a timer. §9.2 is explicit:
 * reaching deletion eligibility never auto-deletes.
 */

import { unscopedScope } from "@nesto/database";
import { logger } from "@nesto/observability";

export async function sweepExpiredIdempotencyKeys(): Promise<number> {
  const { count } = await unscopedScope((tx) =>
    tx.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  );
  if (count) logger.info("retention.idempotency_keys_purged", { count });
  return count;
}

export async function sweepExpiredExports(): Promise<number> {
  // The artifact's own file is removed by the files queue; this marks the row so
  // a stale download link stops resolving immediately, before the object goes.
  const { count } = await unscopedScope((tx) =>
    tx.exportJob.updateMany({
      where: { expiresAt: { lt: new Date() }, status: "READY" },
      data: { status: "EXPIRED" },
    })
  );
  if (count) logger.info("retention.exports_expired", { count });
  return count;
}

export async function sweepPublishedOutbox(olderThanDays = 14): Promise<number> {
  // Published rows are kept for an operational window so a support question can
  // still be answered from them, then removed. The dead-lettered ones stay.
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600_000);
  const { count } = await unscopedScope((tx) =>
    tx.outboxEvent.deleteMany({ where: { status: "PUBLISHED", publishedAt: { lt: cutoff } } })
  );
  if (count) logger.info("retention.outbox_purged", { count });
  return count;
}
