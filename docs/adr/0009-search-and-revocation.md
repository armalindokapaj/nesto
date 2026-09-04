# ADR-0009 — Search technology and revocation SLA

**Status:** Accepted · 2026-09-04 · PRD §22.1, §25.1, Appendix D.9 · Deviation D-2

## Context
§5.1 permits "OpenSearch/Elasticsearch-compatible or PostgreSQL first". Search is a derived store, and the
dangerous failure of a derived store is showing a record to someone whose access was revoked.

## Decision
- **PostgreSQL first.** `tsvector` with weighted lexemes plus `pg_trgm` for fuzzy/autocomplete, in the
  `integration` schema as `search_document`, one row per indexed record carrying tenant/company/project
  scope, `sourceType`, `sourceId`, `sourceVersion`, `indexVersion`, `discoveryClass` and the minimized
  searchable text.
- **Restricted fields are excluded before indexing.** Salary, medical, bid amounts, private notes and
  confidential document bodies never enter the index at all, so no query shape can surface them.
- **Filter before score.** Scope and permission predicates are part of the SQL, applied before ranking,
  counting or faceting (§8.5, §22.1).
- **Recheck on open.** A result is a pointer; opening it re-evaluates source permission (§4.3).
- **Revocation is synchronous.** Because the index lives in the same database, the transaction that
  revokes access also deletes or rescopes the affected `search_document` rows. The §25.1 SLA of 60 s is
  therefore met at 0 s for the common cases, with an asynchronous sweep as backstop for bulk revocations.
- **Port.** All access goes through `SearchPort` in `packages/contracts`. Moving to OpenSearch is an
  adapter plus a backfill; nothing in domain code changes.

## Consequences
- One less piece of infrastructure, one less place for ACLs to go stale, and transactional revocation
  that an external index physically cannot offer.
- Ranking quality is below a dedicated engine, and very large corpora will eventually justify one. The
  port and the rebuildability requirement keep that a migration rather than a rewrite.
