# ADR-0008 — Audit immutability and tamper evidence

**Status:** Accepted · 2026-09-04 · PRD §10.3, §24.3, Appendix D.8

## Context
Audit is evidence. Evidence that the application can edit is not evidence.

## Decision
- **Grants.** The `audit` schema grants `INSERT` and `SELECT` to `app_runtime` and to no one else;
  `UPDATE` and `DELETE` are granted to nobody, including the owner role at runtime. An attempt fails at
  the database, not at a service check.
- **Self-hash plus rolling seal.** Each `AuditEvent` stores `hash = SHA-256(canonical(event))`, which
  detects modification of that row. Chaining happens *out of band*: a periodic sealing job folds a
  contiguous run of events (ordered by their time-ordered UUIDv7 ids) into an `AuditChainSeal` whose
  `rollingHash` covers every event in the run and chains to the previous seal. A verification job walks
  the seals and alerts on a break, which detects deletion or out-of-band modification even by someone
  with database access.

  **Why not chain every row directly.** The obvious design — each event pointing at its predecessor's
  hash — requires reading the previous hash inside the business transaction, which serialises every
  audited write in a tenant behind a single lock. In a company with fifty people working a site that is
  not a hash chain, it is a global write lock on the whole tenant. The seal gets the property that
  actually mattered (tampering is detectable) without writers ever contending.

- **One updatable column.** The sealing job stamps `sealId` on the events it covers. That is the only
  column-level `UPDATE` grant on the table; every other column, including `hash`, `action` and `actorId`,
  is unwritable after insert. Seals themselves are insert-only, because a seal that could be rewritten
  proves nothing about what it covers.
- **Content** exactly as §24.3, with before/after changes structurally redacted by data classification —
  secrets, tokens, passwords, MFA seeds and salary figures never enter a payload (§7.2).
- **Never cascades.** Audit rows have no foreign key to the business record they describe; deleting a
  business record leaves its evidence intact (§10.3).
- **Activity is separate.** `ActivityEvent` is the permission-filtered user-facing projection, derived
  from the same committed action and correlation ID, and may be rebuilt. Audit may not.
- **Reading audit** requires an explicit permission and is itself audited (§24.3).

## Consequences
- Correction is append-only: a mistaken entry is followed by a corrective entry, never overwritten.
- The chain makes audit rows order-dependent per tenant; the writer serializes per tenant inside the
  business transaction, which is acceptable at the write volumes involved and is measured.
