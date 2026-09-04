/**
 * Retry backoff — PRD §20.4 ("exponential backoff with jitter").
 *
 * Jitter is not decoration. Without it, every consumer that failed during a
 * downstream outage retries at exactly the same instants once it recovers, and
 * the thundering herd knocks the dependency over again. Spreading each delay
 * across a window breaks the synchronisation.
 *
 * The cap matters too: unbounded doubling reaches delays measured in days, and a
 * dead letter that a human can act on is more useful than a retry nobody is
 * waiting for.
 */

export const MAX_ATTEMPTS = 8;
const BASE_MS = 1000;
const CAP_MS = 300_000; // five minutes
const JITTER = 0.25; // ±25%

export function nextAttemptDelayMs(attempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(BASE_MS * 2 ** Math.max(attempts, 1), CAP_MS);
  const factor = 1 - JITTER + random() * (JITTER * 2);
  return Math.round(exponential * factor);
}

export function isExhausted(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
