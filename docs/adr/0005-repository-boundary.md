# ADR-0005 — Prisma repository boundary enforcement

**Status:** Accepted · 2026-09-04 · PRD §5.4, §6.3, Appendix D.5

## Context
"No domain writes another domain's tables" and "every query is scoped" are only real if they are
mechanically impossible to violate, not merely documented.

## Decision
- The generated Prisma client is **not exported** from `packages/database`. It is passed only to domain
  repository factories. Domain code importing `@prisma/client` fails lint and an architecture test.
- Every repository method takes `ctx: ExecutionContext` as its first parameter. There is no overload
  without it.
- `packages/database` provides `scoped(ctx)`, which returns a client whose every `where` is pre-narrowed
  with `tenantId`, and `owningCompanyId` / `projectId` where the model declares them. A domain cannot
  express an unscoped query through the exported surface.
- Writes run inside `unitOfWork(ctx, fn)`, which opens the transaction, applies `set_config` for RLS,
  and exposes `tx`, `audit()` and `emit()` so that the business row, its audit evidence and its outbox
  event commit together or not at all (§5.4).
- Related IDs are validated in-context before write by `ctx.resolve(type, id)`, which throws a
  non-disclosing `NOT_FOUND` when the referenced row is outside scope (§6.3, §8.7 step 5).
- Cross-domain reads use the query contracts in `packages/contracts`; cross-domain writes call the owner's
  application service or publish an event.

## Consequences
- The common failure mode of multi-tenant systems — a forgotten `where tenantId` — cannot be written.
- Raw SQL is permitted only inside `packages/database` and only through helpers that take the context;
  each such helper carries a test proving it scopes.
- Migration and seed scripts run as `app_owner` outside this boundary and are reviewed accordingly.
