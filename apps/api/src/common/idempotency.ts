/**
 * Idempotency — PRD §19.1, §19.4, §26.4.
 *
 * "Duplicate posting command returns original result" is a financial
 * requirement, not a convenience: a client that retries a payment on a timeout
 * must not create a second one.
 *
 * The mechanism is a unique row claimed *before* the handler runs. The second
 * caller either gets the stored response (the first finished) or a CONFLICT
 * (the first is still in flight) — never a second execution. The request hash
 * catches the more dangerous mistake: the same key reused for a different body,
 * which would otherwise return someone else's result.
 */

import { NestoError } from "@nesto/contracts";
import { db, newId } from "@nesto/database";
import { sha256Hex } from "@nesto/crypto";
import type { ExecutionContext } from "@nesto/contracts";

const TTL_HOURS = 24;

export type IdempotentOutcome<T> = { replayed: boolean; value: T };

export async function withIdempotency<T>(
  ctx: ExecutionContext,
  params: { operation: string; key: string | undefined; body: unknown },
  run: () => Promise<T>
): Promise<IdempotentOutcome<T>> {
  if (!params.key) return { replayed: false, value: await run() };

  const requestHash = sha256Hex(JSON.stringify(params.body ?? null));
  const existing = await db.idempotencyKey.findUnique({
    where: { operation_key: { operation: params.operation, key: params.key } },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new NestoError(
        "CONFLICT",
        "This idempotency key was already used with a different request body.",
        { internalReason: "idempotency-key-body-mismatch" }
      );
    }
    if (existing.status === "SUCCEEDED") {
      return { replayed: true, value: existing.responseBody as T };
    }
    if (existing.status === "IN_PROGRESS") {
      throw new NestoError("CONFLICT", "An identical request is already being processed.", {
        internalReason: "idempotency-in-progress",
      });
    }
  }

  await db.idempotencyKey.create({
    data: {
      id: newId(),
      tenantId: ctx.tenantId ?? null,
      operation: params.operation,
      key: params.key,
      requestHash,
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  });

  try {
    const value = await run();
    await db.idempotencyKey.update({
      where: { operation_key: { operation: params.operation, key: params.key } },
      data: { status: "SUCCEEDED", responseBody: value as never, completedAt: new Date() },
    });
    return { replayed: false, value };
  } catch (error) {
    // A failure releases the key so an honest retry can succeed. Keeping it
    // would turn one transient error into a permanently poisoned request.
    await db.idempotencyKey.update({
      where: { operation_key: { operation: params.operation, key: params.key } },
      data: { status: "FAILED", completedAt: new Date() },
    });
    throw error;
  }
}
