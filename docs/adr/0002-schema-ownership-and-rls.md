# ADR-0002 — PostgreSQL schema ownership and RLS context

**Status:** Accepted · 2026-09-04 · PRD §6.3, §11.1, Appendix D.2

## Context
The PRD requires domain-owned schemas with separate write permission, plus row-level security as defense
in depth, plus a transaction-local tenant context that survives connection pooling.

## Decision
**Schemas.** One database, 22 schemas, per the mapping in `docs/ENGINEERING-RESPONSE.md` §3.2. Prisma
`multiSchema` + `prismaSchemaFolder`: one `.prisma` file per domain, each model carrying `@@schema(...)`.
One generated client and one pool; ownership is enforced by grants and by the repository boundary
(ADR-0005), not by separate connections.

**Roles.** `app_owner` owns DDL. `app_runtime` gets `USAGE` on every schema and DML only where a domain
legitimately writes. Per-domain roles (`app_finance`, …) are created and granted by migration; local and
CI runtime connects as `app_runtime` (deviation D-7). The audit schema grants `INSERT`/`SELECT` only —
no `UPDATE`, no `DELETE`, to anyone (ADR-0008).

**RLS.** Every tenant-scoped table:
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <t>
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

**Context.** The unit of work opens a transaction and issues
`SELECT set_config('app.tenant_id', $1, true)` — `true` meaning *local to this transaction*. Never
`SET SESSION`; a pooled connection carrying a previous request's tenant is the exact failure this
prevents. Reads outside a transaction are not permitted for tenant data.

## Consequences
- Two independent barriers: a query lacking scope does not compile (ADR-0005), and if one ever slipped
  through, RLS returns zero rows rather than another tenant's data.
- `FORCE ROW LEVEL SECURITY` means even the table owner is subject to the policy, so a migration or a
  script cannot accidentally bypass it.
- Every tenant read costs one extra `set_config` per transaction. Measured at well under 1 ms; accepted.
- Platform Admin operations run in the `PLATFORM` audience against explicitly non-tenant tables, or with
  a documented, audited elevation for lifecycle operations only.
