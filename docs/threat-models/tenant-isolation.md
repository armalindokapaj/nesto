# Threat model — tenant, company and project isolation

**Scope:** every path by which data belonging to one tenant, company, project or external relationship
could reach a party not entitled to it. PRD §24.1 names these as the first-priority threats and §25.1
sets the tolerance at zero.

## Assets

| Asset | Why it matters |
|---|---|
| Company business records | The product's entire value; leakage is unrecoverable |
| Finance and HR fields | Regulated, and the most damaging single leak class |
| Controlled document revisions | Contractually meaningful; forgery or substitution is a legal event |
| Submitted bids | Competitor visibility destroys the tender product |
| Credentials, MFA seeds, tokens | Enable every other attack |
| Audit evidence | Its value is entirely in being untamperable |
| Object storage keys and signed URLs | Bypass the application layer entirely |

## Trust boundaries

1. Browser → Company Web (untrusted input, authenticated cookie).
2. Company Web (server) → API (service-to-service, forwards the user's authorization; never elevates).
3. Portal browser → API (`EXTERNAL_PORTAL` audience, lowest trust of any authenticated caller).
4. API → Postgres (scoped repositories + RLS).
5. API/worker → object storage (presigned, time-bounded).
6. Worker → API/DB (service identity with explicit context on every job).
7. Platform Admin → API (`PLATFORM` audience; **no routine access to tenant data**, §24.5).

## Attack paths and controls

| # | Path | Control | Test |
|---|---|---|---|
| T1 | Guess or replay another tenant's record ID | Scoped repository requires context; RLS second barrier; non-disclosing 404 | ISO-01, ISO-03 |
| T2 | Reference a foreign ID inside an otherwise valid create/update | Every related ID re-resolved in context before write (ADR-0005) | ISO-02 |
| T3 | Infer existence via counts, facets, autocomplete or search | Aggregation runs on the already-filtered query; restricted fields never indexed | ISO-04 |
| T4 | Keep authority after demotion, suspension or company lock | SecurityStamp checked per request; role read live, never from the token | ACC-11 |
| T5 | Company Admin escalates to Owner | Owner mutations gated on actor being Owner; single-Owner DB constraint; recent auth | ACC-13 |
| T6 | Reach a project through a task, notification, search hit or link | No transitive access: source permission re-evaluated on open, download, export and action | ACC-10 |
| T7 | External partner reads beyond the shared scope | Connection + invitation + live scope re-checked per request; projections only; opaque IDs | ISO-06, ACC-17 |
| T8 | Reuse a signed file URL after revocation | 60-second expiry; authorization at download time, not at link time; revocation invalidates | ISO-09 |
| T9 | Upload malware or a formula-injection CSV | Quarantine bucket, content-sniffed MIME, scan gate, export escaping | — |
| T10 | Take over an account via invitation or recovery | Hashed single-use expiring tokens, generic responses, rate limits, session revocation on success | — |
| T11 | Cross-scope confusion in a job, export or event replay | Scope is in every payload; the consumer re-establishes context; inbox dedupe | ISO-08 |
| T12 | Read stale data from search, cache or a read model after revocation | Revocation is transactional with index update; caches keyed by scope + permission revision | ISO-10 |
| T13 | Alter or delete audit evidence | No UPDATE/DELETE grant anywhere; per-tenant hash chain with a verification job | ACC-22 |
| T14 | Platform Admin browses tenant data | No tenant explorer exists; lifecycle operations are narrow, audited and enumerated | ACC-12 |
| T15 | Pooled connection carries a previous request's tenant GUC | `SET LOCAL` inside the request transaction only; asserted by a repository test | ISO-01 |

## Residual risks

- **The `permissive-dev` scanner** (deviation D-3) means local uploads are not really scanned. Production
  boot refuses the driver, and the gate itself is real and tested.
- **No penetration test** has been performed (D-1). §24.2 requires one before production and after material
  auth changes; that remains outstanding and is not claimed as done.
- **Time-ordered UUIDv7** discloses approximate creation time to a holder of an ID. Internal only; external
  audiences receive opaque IDs.
- **Hash-chained audit** detects tampering; it does not prevent an operator with database superuser rights
  from truncating and re-chaining. Full tamper-proofing needs external anchoring, which is out of scope
  until hosting exists.
