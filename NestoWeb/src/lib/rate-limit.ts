import "server-only";
import { db } from "@/lib/db";
import { headers } from "next/headers";

// Phase 3 Track A — login() and authenticatePublicAccount() already do the
// careful half of brute-force defence: both compare against a dummy bcrypt hash
// when no user matches, so response shape and timing cannot enumerate accounts.
// Neither limited how many times someone could try.
//
// Backed by the existing Postgres rather than Redis: adding a second data store,
// vendor and env var for one narrow feature is complexity this does not need at
// this scale, and an indexed count over a 15-minute window is ample.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type LockoutState = { locked: boolean; remaining: number };

/**
 * Keyed on the identifier as typed, not on a resolved user — an attempt that
 * matches no account still counts, which is also what keeps the lockout message
 * non-enumerating: it looks identical for a real account and an invented one.
 */
export async function checkLoginLockout(identifier: string): Promise<LockoutState> {
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await db.loginAttempt.count({
    where: { identifier, succeeded: false, createdAt: { gte: since } },
  });
  return { locked: failures >= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - failures) };
}

export async function isLoginLocked(identifier: string): Promise<boolean> {
  return (await checkLoginLockout(identifier)).locked;
}

export async function recordLoginAttempt(identifier: string, succeeded: boolean) {
  await db.loginAttempt.create({ data: { identifier, succeeded, ip: await clientIp() } });
  // A success clears the identifier's recent failures, so someone who mistyped
  // twice and then got it right is not punished for the rest of the window.
  if (succeeded) {
    await db.loginAttempt.deleteMany({ where: { identifier, succeeded: false } });
  }
}

/** Best-effort, for forensics only — never used as the rate-limit key, since a header is trivially spoofed. */
async function clientIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  } catch {
    return undefined;
  }
}

/** Housekeeping — attempts outside the window have no bearing on any decision. */
export async function pruneLoginAttempts() {
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS * 4) } } });
}
