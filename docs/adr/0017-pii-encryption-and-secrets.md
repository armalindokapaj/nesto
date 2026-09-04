# ADR-0017 — PII encryption and secret management

**Status:** Accepted · 2026-09-04 · PRD §24.2, §24.4, Appendix D.17

## Context
Some stored values are dangerous at rest even inside an authorized database: MFA seeds, recovery codes,
integration credentials, and a small set of personal identifiers.

## Decision
- **Classification first.** `docs/requirements/data-classification.csv` assigns every sensitive column one
  of `PUBLIC`, `INTERNAL`, `RESTRICTED`, `CONFIDENTIAL`, plus a retention class. The classification drives
  encryption, audit redaction, index exclusion and export policy — one table, four behaviors.
- **Envelope encryption** in `packages/crypto`: AES-256-GCM with a per-record data key wrapped by a key
  encryption key. Ciphertext stores key id, IV and auth tag, so key rotation re-wraps without re-encrypting
  payloads.
- **Encrypted at rest in the application:** MFA secrets, integration credentials, webhook signing secrets,
  and any national identifier the product stores. **Hashed, never encrypted:** passwords, recovery codes,
  invitation/recovery tokens, refresh tokens — these never need to be read back.
- **Not encrypted:** ordinary business data. Encrypting everything would defeat indexing and add no defense
  against the actual threat model, which is authorization failure, not disk theft.
- **Secrets** come from the environment in development and from a managed secret store in production; the
  repository contains `.env.example` only, and a secret scan runs in CI. A missing required secret fails
  fast at boot rather than degrading silently.
- **Audit redaction** is driven by the same classification, so a `CONFIDENTIAL` field's before/after value
  is replaced by a change marker rather than its content (§24.3).
- **Production data is never copied to staging or developer machines** (§24.4); fixtures are synthetic.

## Consequences
- The blast radius of a database read is bounded for the values where that matters.
- Encrypted columns are not searchable or sortable, which is why the classification exercise precedes the
  schema rather than following it.
