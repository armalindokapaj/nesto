/**
 * Rate limiting — PRD §7.2, §24.2.
 *
 * "Rate-limited by IP **and** normalized identity" is the important detail: an
 * attacker spreading a credential-stuffing run across a botnet defeats an
 * IP-only limit, and one behind a corporate NAT is punished by it. Both keys
 * are counted, and either can trip.
 *
 * In-memory here. Redis-backed is the production shape and the interface does
 * not change; this is a single-process API in the current deployment.
 */

import { NestoError } from "@nesto/contracts";

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitRule = { limit: number; windowSeconds: number };

/** The risk-tiered rules of §24.2 ("by audience/action risk"). */
export const RATE_LIMITS: Record<string, RateLimitRule> = {
  "auth.sign-in": { limit: 10, windowSeconds: 300 },
  "auth.mfa": { limit: 10, windowSeconds: 300 },
  "auth.recovery": { limit: 5, windowSeconds: 900 },
  "auth.invitation": { limit: 10, windowSeconds: 900 },
  "auth.refresh": { limit: 60, windowSeconds: 300 },
  "portal.read": { limit: 300, windowSeconds: 60 },
  "public.read": { limit: 120, windowSeconds: 60 },
  "api.write": { limit: 600, windowSeconds: 60 },
};

export function consume(action: string, key: string, rule?: RateLimitRule): void {
  const limit = rule ?? RATE_LIMITS[action] ?? { limit: 600, windowSeconds: 60 };
  const bucketKey = `${action}:${key}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + limit.windowSeconds * 1000 });
    return;
  }
  existing.count += 1;
  if (existing.count > limit.limit) {
    throw new NestoError("RATE_LIMITED", "Too many attempts. Try again shortly.", {
      internalReason: `rate-limit:${action}`,
      meta: { retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) },
    });
  }
}

/** Both keys are consumed, so either can trip the limit independently. */
export function consumeByIpAndIdentity(action: string, ip: string, identity: string | undefined): void {
  consume(action, `ip:${ip}`);
  if (identity) consume(action, `id:${normalizeIdentity(identity)}`);
}

/** Case and dot-folding, so `A.User@Example.com` and `auser@example.com` share
 *  a bucket rather than giving an attacker free attempts per spelling. */
export function normalizeIdentity(value: string): string {
  const lower = value.trim().toLowerCase();
  const [local, domain] = lower.split("@");
  if (!domain) return lower;
  return `${(local ?? "").replace(/\./g, "").split("+")[0]}@${domain}`;
}

export function resetRateLimitsForTest(): void {
  buckets.clear();
}
