# ADR-0004 — Policy engine and field-level serialization

**Status:** Accepted · 2026-09-04 · PRD §8, Appendix D.4

## Context
Authorization must be deny-by-default, server-side, scope-aware, evaluated before data is loaded, with
explicit deny winning, and it must reach fields and not just routes.

## Decision
- **Manifest, not code.** Each domain exports a `PermissionDefinition[]` (Appendix B's shape). The union is
  the platform's permission vocabulary; a permission key used but not declared fails an architecture test.
- **Evaluation order** exactly as §8.1, implemented as an ordered pipeline in `packages/policy`. Each stage
  may return `DENY` and short-circuit; only a full pass returns `ALLOW`. An explicit deny grant beats any
  allow at any stage.
- **Decision before data.** `policy.can(ctx, key, scopeRef)` answers from context, membership, grants and
  project membership without loading the target record. Record-level rules run in a second pass,
  `policy.canOnRecord(ctx, key, record)`, only after a scoped repository has loaded it.
- **Field sets.** A decision returns `{ allow, fields, reasons }`. `fields` is the allowlist the repository
  `select`s — prohibited columns are never read from the database, so they cannot leak through a log, a
  serializer bug, or an error payload. This is why field policy lives before the query, not after it.
- **Serializer contract.** DTO mappers take `(record, decision)` and cannot be called without one.
- **Aggregation.** Counts, facets, sums and autocompletes run on the already-filtered query, per §8.5.
- **Caching.** A decision is memoized per request only. Nothing about permissions is cached across
  requests; revocation must not wait for a TTL.

## Consequences
- Adding a field to a sensitive DTO without adding it to the field set yields `undefined`, which is a
  visible, testable failure rather than a silent leak.
- Route guards remain, but they are the coarse first pass; they are never sufficient on their own.
