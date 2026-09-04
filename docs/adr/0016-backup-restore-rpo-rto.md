# ADR-0016 — Backup, restore, RPO and RTO

**Status:** Accepted · 2026-09-04 · PRD §25.4, Appendix D.16 · Related deviation D-1

## Context
§25.1 targets RPO ≤ 15 minutes and RTO ≤ 4 hours. Neither is achievable — or meaningful — without a
selected production platform, which is out of scope here.

## Decision
- **Authoritative state is Postgres plus object storage, and only those.** Search, read models, projections
  and caches are declared rebuildable and are excluded from the restore path by design, which is what keeps
  RTO achievable at all.
- **Rebuild is a first-class, tested operation**, not a theory: `pnpm ops:rebuild-derived` reconstructs the
  search index and every read model from source and outbox history, and a CI job runs it against seeded
  data so it cannot rot.
- **Local:** `scripts/backup.sh` performs a `pg_dump` plus a MinIO mirror, and `scripts/restore.sh`
  restores both into a clean stack. A CI job restores a dump and runs the smoke suite against it, which
  proves the restore path even without a cloud.
- **Production (when provisioned):** managed Postgres with PITR configured for ≤ 15-minute RPO, object
  storage versioning with retention matching the controlled-record retention matrix, quarterly restore
  drills into an isolated environment, and a DR exercise that covers database, objects, secrets and
  queue/outbox recovery.
- **Replay safety:** a restored system reconciles derived stores and must not re-fire external side
  effects already confirmed (§25.4, ADR-0006).
- Backups are never selectively rewritten to satisfy a deletion request; they expire on their normal
  retention cycle (§9.2).

## Consequences
- The numeric targets remain aspirational until hosting is chosen, and this ADR must be revisited then.
- The parts under our control — what is authoritative, what is rebuildable, and a tested restore — are done
  now rather than deferred with them.
