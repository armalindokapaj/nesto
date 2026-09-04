# ADR-0018 — External portal projection boundary

**Status:** Accepted · 2026-09-04 · PRD §15.4, §18.3, §28.17, Appendix D.18

## Context
An external company may run its own Nesto ERP while participating in someone else's project. The two must
never touch, and "no external relationship means no business data, even for a valid account."

## Decision
- **Separate audience.** Portal sessions are `EXTERNAL_PORTAL`, issued from a distinct cookie path and
  token audience, with their own rate limits. A company session is not usable on a portal route and the
  reverse is also true.
- **Three gates on every request**, in order: an `ACTIVE` `CompanyConnection`; an accepted
  `ProjectInvitation`; a live, in-window, unrevoked `ExternalAccessScope` naming the module, record type,
  action and field projection. All three are re-evaluated per request — none is cached into the session.
- **Projections only.** Portal endpoints read from `portals`-owned projection tables or from a source-owned
  safe query that takes the scope as a parameter. A portal handler that touches an internal repository
  fails the architecture test.
- **Opaque IDs.** External responses carry `HMAC-SHA256(internalId, purpose, scopeId)` truncated and
  base32-encoded, resolved back only inside the scope that issued them. An internal UUID is never emitted
  to an external audience, so an ID obtained from one relationship is meaningless in another.
- **Immutable submissions.** An external submission is a snapshot; after submit there is no `PATCH`, only
  a new revision. Internal acceptance or rejection is a separate, source-owned action (§18.3).
- **Revocation is total:** it invalidates portal sessions, projection rows, caches, search entries and any
  outstanding file access in one transaction, and emits `external.scope.changed.v1`.
- **Downloads reauthorize** against the current scope at the moment of download, never against the scope
  that rendered the link (§18.3).

## Consequences
- The partner's private execution — who they assigned, at what cost — is structurally invisible to the
  issuer, because it was never in the projection to begin with.
- Portal features cost a projection each. That is the intended friction: sharing is an explicit act.
