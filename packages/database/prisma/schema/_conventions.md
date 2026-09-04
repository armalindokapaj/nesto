# Schema conventions

One `.prisma` file per bounded context. Every model declares `@@schema`, which is what makes the
"no domain writes another domain's tables" rule enforceable by database grants (ADR-0002).

## Types

- **Identifiers** are `String @db.Uuid`, generated in the application as UUIDv7 (ADR-0001). Never
  `@default(uuid())` — a command builds its whole aggregate graph before touching the database, and an
  idempotent retry has to be able to reuse the same IDs.
- **Status columns** are `String`, not Prisma enums. PRD §11.2 types `lifecycleStatus` as a string, and
  §Appendix A permits companies to add intermediate display states mapped to protected categories. The
  protected sets are enforced by `CHECK` constraints added in migration SQL, and the legal *transitions*
  are enforced by the transition table in the owning domain — which a database enum could never do.
- **Timestamps** are `@db.Timestamptz(6)`. Business dates that are not instants are `@db.Date`.
- **Money** is `@db.Decimal(20, 4)` with a sibling `currency` column; totals are `@db.Decimal(24, 4)`
  (ADR-0011). Never `Float`.
- **Quantities** are `@db.Decimal(20, 6)` with a UOM code.

## Cross-domain references

`createdBy`, `updatedBy` and any reference to a record owned by another domain are plain `@db.Uuid`
columns with **no foreign key**. This is deliberate: §11.4 forbids cross-domain cascade delete, and a
reference must never transfer permission. Existence is validated through the owning domain's contract at
write time (`ctx.resolve`), not by the database.

Relations *within* one bounded context do use foreign keys, because there the domain owns both sides.

## Required columns

Every tenant-owned model carries `tenantId`. Every company-owned model also carries `owningCompanyId`.
Every project-scoped model also carries `projectId`, even where it could be inferred — §6.3 requires the
scope to be explicit so the scoped repository and the RLS policy can both see it.
