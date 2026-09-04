/**
 * Identifier generation — ADR-0001.
 *
 * UUIDv7 rather than v4: the first 48 bits are a millisecond timestamp, so rows
 * created together sort together and index inserts append instead of scattering
 * across the B-tree. On a table with hundreds of millions of audit rows that is
 * the difference between a healthy index and a fragmented one.
 *
 * Generated in the application, never by the database, for two reasons that
 * both matter: a command can build an entire aggregate graph before it opens a
 * transaction, and an idempotent retry can reuse exactly the same identifiers.
 */

import { uuidv7 } from "uuidv7";

export function newId(): string {
  return uuidv7();
}

/** Recover the creation instant from an ID. Useful for cursor pagination and
 *  for diagnosing "when was this actually written". */
export function idCreatedAt(id: string): Date {
  const hex = id.replace(/-/g, "").slice(0, 12);
  return new Date(parseInt(hex, 16));
}

/**
 * A short, human-quotable suffix — for a support reference or a test fixture's
 * unique code.
 *
 * Takes the *tail*, never the head. The first 48 bits of a UUIDv7 are a
 * millisecond timestamp, so two ids minted in the same millisecond share their
 * leading twelve hex digits; `id.slice(0, 8)` looks unique and is not. The
 * entropy lives at the other end.
 */
export function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(-8);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
