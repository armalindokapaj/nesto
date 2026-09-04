# ADR-0008 — Audit immutability and tamper evidence

**Status:** Accepted · 2026-09-04 · PRD §10.3, §24.3, Appendix D.8

## Context
Audit is evidence. Evidence that the application can edit is not evidence.

## Decision
- **Grants.** The `audit` schema grants `INSERT` and `SELECT` to `app_runtime` and to no one else;
  `UPDATE` and `DELETE` are granted to nobody, including the owner role at runtime. An attempt fails at
  the database, not at a service check.
- **Hash chain.** Each `AuditEvent` stores `previousHash` and `hash = SHA-256(canonical(event) || previousHash)`,
  chained per tenant. A verification job walks the chain and alerts on a break, which detects deletion or
  out-of-band modification even by someone with database access.
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
