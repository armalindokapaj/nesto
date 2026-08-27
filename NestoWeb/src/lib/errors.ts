import { reportError, isInternalError } from "@/lib/observability";

/**
 * Phase 5 Track C — use instead of `err instanceof Error ? err.message : fallback`
 * in action catch blocks.
 *
 * This app's convention is to `throw new Error("Invoice not found.")` with a
 * message deliberately written for the user, and those pass through unchanged —
 * rewriting them would be busywork. The leak this closes is narrower: a Prisma
 * error escaping into the same catch block puts whatever Postgres said —
 * constraint names, column names, connection details — straight on the user's
 * screen. Those are reported in full and replaced with the caller's fallback.
 */
export function toActionError(err: unknown, fallback: string): string {
  if (isInternalError(err)) {
    reportError(err, { fallback });
    return fallback;
  }
  return (err as Error).message;
}
