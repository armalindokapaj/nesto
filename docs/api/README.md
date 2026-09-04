# API catalogue

Base path `/api/v1`. Contracts are Zod schemas in `packages/contracts`; NestJS DTOs and the generated
TypeScript client are both derived from them, so neither can drift. The generated OpenAPI document is
written to `docs/api/openapi.json` on every build and checked for breaking changes in CI.

## Conventions (PRD §19.1)

- `camelCase` JSON properties, `UPPER_SNAKE_CASE` enum values.
- ISO 8601 UTC instants; `YYYY-MM-DD` for local business dates.
- Decimal values are **strings**, never JSON numbers.
- IDs are opaque strings; external audiences receive HMAC'd opaque IDs (ADR-0018).
- Cursor pagination for activity, audit, feed and search; page pagination only for bounded admin tables.
- Filter and sort fields are allowlisted per endpoint.
- `Idempotency-Key` required on retryable mutations; `If-Match` on versioned updates.
- Envelopes exactly as PRD §19.2 / §19.3; error codes as §19.8.

## Namespaces (PRD §19.6)

`/auth` `/me` `/platform` `/companies/current` `/organization` `/projects` `/tasks` `/documents` `/rfis`
`/submittals` `/design-changes` `/variations` `/contracts` `/finance` `/procurement` `/inventory` `/site`
`/quality` `/hse` `/hr` `/crm` `/network` `/jobs` `/tenders` `/external` `/workflows` `/notifications`
`/search` `/reports` `/imports` `/exports`

Plus `/views` — read-only composed page endpoints, ADR-0019 (deviation D-8).

## High-risk endpoint rules (PRD §19.7)

- Upload is two-step (`intent` → `complete`) and cannot publish before a clean scan.
- Finance posting/reversal revalidates state and version and requires approval where configured.
- Owner transfer and privileged changes require recent authentication.
- Bulk, import, tree, schedule and lifecycle changes require a preview token.
- Submitted external records have no `PATCH`; a revision endpoint creates a new immutable version.
- Downloads issue a short-lived signed URL after a fresh policy check; object keys are never public.
