# Architecture Decision Register

Appendix D of NESTO-ARCH-PRD-001 requires eighteen ADRs before Sprint 1. All eighteen are recorded,
plus ADR-0019 covering the one addition this team proposes to the API surface.

| ADR | Title | Status | PRD anchor |
|---|---|---|---|
| [0001](0001-uuidv7-identifiers.md) | UUIDv7 identifiers | Accepted | §4.6 |
| [0002](0002-schema-ownership-and-rls.md) | PostgreSQL schema ownership and RLS context | Accepted | §6.3, §11.1 |
| [0003](0003-authentication-sessions-refresh.md) | Authentication, sessions and refresh tokens | Accepted | §7.2 |
| [0004](0004-policy-engine.md) | Policy engine and field-level serialization | Accepted | §8 |
| [0005](0005-repository-boundary.md) | Prisma repository boundary enforcement | Accepted | §5.4 |
| [0006](0006-transactional-outbox.md) | Transactional outbox and consumer idempotency | Accepted | §20.3–20.6 |
| [0007](0007-object-storage-scanning-signed-access.md) | Object storage, malware scan and signed access | Accepted | §21 |
| [0008](0008-audit-immutability.md) | Audit immutability and tamper evidence | Accepted | §24.3 |
| [0009](0009-search-and-revocation.md) | Search technology and revocation SLA | Accepted | §22.1 |
| [0010](0010-reporting-store-evolution.md) | Reporting store evolution path | Accepted | §22.2 |
| [0011](0011-decimal-precision-matrix.md) | Decimal precision and rounding matrix | Accepted | §11.5 |
| [0012](0012-tree-and-graph-storage.md) | Tree/graph storage and revision strategy | Accepted | §12.4–12.12 |
| [0013](0013-workflow-finalization-handshake.md) | Workflow source-finalization handshake | Accepted | §10.2 |
| [0014](0014-feature-and-module-registry.md) | Feature/module registry and company variations | Accepted | §10.4 |
| [0015](0015-cicd-environments-migrations.md) | CI/CD, environment promotion and migrations | Accepted | §27.1 |
| [0016](0016-backup-restore-rpo-rto.md) | Backup, restore, RPO and RTO | Accepted | §25.4 |
| [0017](0017-pii-encryption-and-secrets.md) | PII encryption and secret management | Accepted | §24.2 |
| [0018](0018-external-portal-projection-boundary.md) | External portal projection boundary | Accepted | §18.3 |
| [0019](0019-composed-view-endpoints.md) | Composed page-view endpoints | Accepted (deviation D-8) | §19.6, §22.3 |

Deviations from the PRD are listed in `../ENGINEERING-RESPONSE.md` §11 and each points back to its ADR.
