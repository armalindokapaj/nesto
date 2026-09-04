# Runbooks

Every operationally critical behavior in the PRD has a runbook here before it is considered done
(§26.5 Definition of Done, §27.1 release gates). Each has: symptom, safe diagnosis, action, verification,
and what to do if the action fails.

| Runbook | Covers | Phase |
|---|---|---|
| `outbox-lag.md` | Relay stalled, outbox backlog growing, consumer checkpoint stuck | 0 |
| `dead-letter-replay.md` | Inspecting, deciding on and replaying dead letters with permission and audit | 0 |
| `rebuild-derived.md` | Rebuilding search index and read models from source | 0 |
| `backup-restore.md` | Taking and verifying a backup; restoring database and objects | 0 |
| `company-lifecycle.md` | Suspension, grace expiry, lock, reactivation, deletion eligibility | 1 |
| `company-deletion.md` | The dependency-ordered, idempotent, non-automatic deletion procedure | 1 |
| `owner-transfer.md` | Recovering a company whose Owner is unreachable | 1 |
| `provisioning-stuck.md` | A project stuck in PROVISIONING with a failed handler | 1 |
| `schedule-apply-conflict.md` | Stale previews, revision conflicts, partially applied schedules | 2 |
| `file-scan-backlog.md` | Scanner down, files stuck in SCANNING | 3 |
| `workflow-not-finalized.md` | Outcome reached but source finalization never confirmed | 3 |
| `finance-posting-recovery.md` | A posting that failed after partial side effects; reversal procedure | 4 |
| `external-scope-revocation.md` | Verifying that a revocation reached sessions, projections, search and files | 5 |

Runbooks are written with the phase that introduces the behavior, not retrospectively.
