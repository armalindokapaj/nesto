/**
 * Password hashing — ADR-0003, PRD §7.2.
 *
 * Argon2id at the OWASP 2024 baseline: 19 MiB of memory, two iterations, one
 * lane. Memory is the parameter that matters — it is what makes a GPU farm
 * expensive, and iteration count alone does not.
 *
 * The parameters travel *inside* the hash string, which is what lets them be
 * raised later without invalidating a single existing credential: verify reads
 * the cost from the stored hash, and `needsRehash` tells the sign-in path when
 * to quietly upgrade one.
 */

import { hash, verify, Algorithm } from "@node-rs/argon2";

export const ARGON2_PARAMS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }
  return hash(plain, ARGON2_PARAMS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    // A malformed or truncated hash verifies as false rather than throwing:
    // a corrupted row must not become a 500 that tells an attacker the account
    // exists and is interesting.
    return false;
  }
}

/** True when the stored hash was made with weaker parameters than current. */
export function needsRehash(stored: string): boolean {
  const m = /\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored);
  if (!m) return true;
  return (
    Number(m[1]) < ARGON2_PARAMS.memoryCost ||
    Number(m[2]) < ARGON2_PARAMS.timeCost ||
    !stored.startsWith("$argon2id$")
  );
}

/**
 * A deliberate constant-time-ish dummy verification.
 *
 * When an email does not exist, sign-in must still take about as long as it
 * would for a real account. Returning early is a user-enumeration oracle that
 * no amount of generic error messaging hides.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$JcaG7MEXFPMU1nS6/ZBHZ2DkS7VqPLbBmJcMLGRSc0Y";

export async function burnVerificationTime(): Promise<void> {
  await verifyPassword("not-the-password", DUMMY_HASH);
}
