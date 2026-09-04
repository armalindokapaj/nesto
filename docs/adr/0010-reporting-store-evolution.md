# ADR-0010 — Reporting store evolution path

**Status:** Accepted · 2026-09-04 · PRD §22.2, Appendix D.10 · Deviation D-6

## Context
§22.2 distinguishes operational lists (source/read-model queries) from heavy cross-domain analytics
(derived store). Building a warehouse before the domains exist would be premature; never building one
would cap the product.

## Decision
- **Stage 1 (Phases 1–6):** read models in the `integration` schema, maintained by outbox consumers, one
  per report family. Every fact row carries `sourceDomain`, `sourceId`, `sourceVersion` and effective
  time, so lineage holds from the start and a warehouse can be seeded from it later.
- **Stage 2 (Phase 7):** a separate analytical store fed by the same events, when at least one of these is
  measured: report queries degrade the operational primary, cross-domain joins exceed what read models can
  precompute, or retention of analytical history exceeds the operational retention policy.
- **Metrics are governed.** `MetricDefinition` carries a version; a report output records which metric
  version produced it, so a historical report remains reproducible when a formula changes (§22.2).
- **Permission before aggregation** always, including for snapshots and scheduled exports (§8.5).
- **Freshness is shown**, never implied: every report and widget renders `generatedAt` and the freshness of
  its slowest input, and a stale or partial projection says so.
- Analytics never writes back to a source (§4.2).

## Consequences
- Phases 1–6 need no additional infrastructure and reports stay transactionally consistent with sources.
- The Stage-2 trigger is a measurement, not an opinion, which keeps the decision honest.
