# ADR-0015 — CI/CD, environment promotion and migrations

**Status:** Accepted · 2026-09-04 · PRD §5.1, §27.1, Appendix D.15 · Deviations D-1, D-4, D-5

## Context
The Product Owner has scoped this engagement to local Docker with commits pushed to `origin/main`. No
cloud environment is provisioned. The pipeline must nevertheless be production-shaped.

## Decision
**Local:** `docker compose up` provides Postgres 17, Redis 7, MinIO and Mailpit. `pnpm dev` runs api,
worker, company-web and platform-admin through Turborepo.

**CI (GitHub Actions), in order, all blocking:**
`typecheck` → `lint` → `architecture` (domain boundaries, permission manifest, scoped-repository rules) →
`unit` → `integration` against a real Postgres service with RLS on → `openapi-compat` →
`event-schema-compat` → `isolation` (§26.2 matrix) → `e2e` (Playwright) → `perf-budget` → `build`.
Secret scan, dependency audit and SAST run alongside.

**Migrations:** `prisma migrate` with a checked-in migration history. Deploys run `migrate deploy` before
the new version starts. Every migration must be backward-compatible with the running version — expand,
migrate, contract — so a rollback never needs a down-migration. A `migration-register.csv` records intent,
risk, expected cardinality and rollback for each.

**Deviations:** no staging/production environment, CDN/WAF, managed secret store or penetration test
(D-1); email is Mailpit locally with provider adapters as interfaces (D-4); OpenTelemetry is instrumented
with an OTLP exporter disabled by default locally (D-5). All three are environment provisioning, not
application design, and none of them changes a line of domain code when they are supplied.

## Consequences
- Everything the PRD asks for that can be verified without a cloud account is verified on every commit.
- The gaps are explicit and each is one configuration away from being closed.
