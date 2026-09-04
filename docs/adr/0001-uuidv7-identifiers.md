# ADR-0001 — UUIDv7 identifiers

**Status:** Accepted · 2026-09-04 · PRD §4.6, Appendix D.1

## Context
Every internal ID must be globally unique and time-ordered. Random UUIDv4 primary keys fragment B-tree
index inserts badly at scale; sequential integers leak volume and are guessable across tenants.

## Decision
- All primary keys are **UUIDv7**, generated in the application by the `uuidv7` package, never in the
  database. Generation in application code means a command can build a whole aggregate graph before it
  touches the database, and an idempotent retry can reuse the same IDs.
- Postgres column type is native `uuid` (16 bytes), declared in Prisma as `String @db.Uuid`.
- `packages/database` exports `newId()`; direct `randomUUID()`/`uuid4()` in domain code is banned by lint.
- Human-facing codes (`code`) come from the Numbering engine and are never primary keys (§4.6).
- External surfaces never expose an internal UUID directly; portals receive an opaque HMAC'd resource ID
  (ADR-0018).

## Consequences
- Index locality is preserved: rows created together sort together, so inserts append rather than scatter.
- `createdAt` is recoverable from the ID, which makes cursor pagination on `(created_at, id)` stable.
- Time-ordering leaks approximate creation time to anyone holding an ID. Acceptable internally; the
  opaque external ID exists precisely so it does not leak outward.
