/**
 * The audit sealing job — ADR-0008.
 *
 * Folds a contiguous run of unsealed audit events into one seal whose rolling
 * hash covers all of them and chains to the previous seal. Deleting or altering
 * any covered event breaks verification of its seal.
 *
 * This exists so that writers never contend. Chaining each row to its
 * predecessor would mean reading the previous hash inside the business
 * transaction, which serialises every audited write in a tenant behind one
 * lock — in a company with fifty people on a site, a global write lock.
 *
 * Events are ordered by id, and UUIDv7 ids are time-ordered, so an id range is
 * a time range and the run a seal covers is unambiguous.
 */

import { chainHash } from "@nesto/crypto";
import { unscopedScope, newId } from "@nesto/database";
import { logger } from "@nesto/observability";

const BATCH = 500;

export async function sealOnce(): Promise<{ seals: number; events: number }> {
  const tenants = await unscopedScope((tx) =>
    tx.$queryRaw<{ tenantId: string | null }[]>`
      SELECT DISTINCT "tenantId" FROM audit.audit_event WHERE "sealId" IS NULL LIMIT 200
    `
  );

  let seals = 0;
  let events = 0;

  for (const { tenantId } of tenants) {
    const sealed = await sealTenant(tenantId);
    if (sealed > 0) {
      seals += 1;
      events += sealed;
    }
  }

  if (seals) logger.info("audit.sealed", { seals, events });
  return { seals, events };
}

async function sealTenant(tenantId: string | null): Promise<number> {
  return unscopedScope(async (tx) => {
    const pending = await tx.auditEvent.findMany({
      where: { tenantId, sealId: null },
      select: { id: true, hash: true },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (pending.length === 0) return 0;

    const previous = await tx.auditChainSeal.findFirst({
      where: { tenantId },
      orderBy: { sealedAt: "desc" },
      select: { rollingHash: true },
    });

    let rolling = previous?.rollingHash ?? null;
    for (const event of pending) rolling = chainHash(rolling, event.hash);

    const sealId = newId();
    await tx.auditChainSeal.create({
      data: {
        id: sealId,
        tenantId,
        fromAuditId: pending[0]!.id,
        toAuditId: pending[pending.length - 1]!.id,
        eventCount: pending.length,
        rollingHash: rolling as string,
        previousSealHash: previous?.rollingHash ?? null,
      },
    });

    // The only column on audit_event anyone may update, and the only reason the
    // grant exists.
    await tx.auditEvent.updateMany({
      where: { id: { in: pending.map((e) => e.id) } },
      data: { sealId },
    });

    return pending.length;
  });
}

/**
 * Verification. Walks the seals of one tenant in order and recomputes each
 * rolling hash from the events it claims to cover. A mismatch means an event was
 * deleted or altered out of band — which is precisely the thing no
 * application-level control could otherwise detect.
 */
export async function verifyChain(tenantId: string | null): Promise<{ ok: boolean; brokenSealId?: string }> {
  return unscopedScope(async (tx) => {
    const seals = await tx.auditChainSeal.findMany({
      where: { tenantId },
      orderBy: { sealedAt: "asc" },
    });

    let previous: string | null = null;
    for (const seal of seals) {
      if (seal.previousSealHash !== previous) return { ok: false, brokenSealId: seal.id };

      const covered = await tx.auditEvent.findMany({
        where: { sealId: seal.id },
        select: { hash: true },
        orderBy: { id: "asc" },
      });
      if (covered.length !== seal.eventCount) return { ok: false, brokenSealId: seal.id };

      let rolling: string | null = previous;
      for (const event of covered) rolling = chainHash(rolling, event.hash);
      if (rolling !== seal.rollingHash) return { ok: false, brokenSealId: seal.id };

      previous = seal.rollingHash;
    }
    return { ok: true };
  });
}
