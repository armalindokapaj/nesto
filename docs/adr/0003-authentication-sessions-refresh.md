# ADR-0003 — Authentication, sessions and refresh tokens

**Status:** Accepted · 2026-09-04 · PRD §7.2, Appendix D.3

## Context
The PRD requires Argon2id, a short-lived access credential, a rotating refresh-token family with reuse
detection, mandatory MFA for Platform Admin and Primary Owner, and a security stamp that invalidates
sessions when authority changes.

## Decision
- **Hashing:** Argon2id via `@node-rs/argon2`, `m=19456 KiB, t=2, p=1` (OWASP 2024 baseline), parameters
  stored alongside the hash so they can be raised without invalidating existing credentials.
- **Access token:** JWT, 10-minute lifetime, carries `sessionId`, `userId`, `audience`, `securityStamp`.
  It carries **no role and no permissions** — those are resolved live per request. A signed token is a
  claim about identity, never about authority.
- **Refresh token:** opaque 256-bit random, stored hashed, in a `Secure; HttpOnly; SameSite=Lax` cookie,
  scoped per audience (`/` for company, `/platform` for platform). Rotated on every use; the old token is
  marked `ROTATED` with its successor recorded.
- **Reuse detection:** presenting a `ROTATED` or `REVOKED` token revokes the entire family, kills every
  session it produced and writes a `SECURITY_REFRESH_REUSE` audit event.
- **Security stamp:** one row per user, bumped on password change, MFA change, role/membership change,
  company lifecycle change and privileged-access change. A request whose token stamp ≠ current stamp is
  rejected. This is the mechanism that makes revocation immediate rather than eventual.
- **MFA:** TOTP (RFC 6238, 30 s, 6 digits, ±1 window), secret encrypted at rest (ADR-0017), plus ten
  single-use recovery codes stored as Argon2id hashes. Mandatory for `PLATFORM_ADMIN` and for the company
  `OWNER`; configurable per company for everyone else.
- **Recent authentication:** privileged actions require a re-authentication within the last 10 minutes,
  recorded on the session as `lastStrongAuthAt`.
- **CSRF:** double-submit token on every cookie-authenticated mutation plus strict `Origin` checking.
- **Rate limits:** per IP and per normalized identity on sign-in, recovery, invitation and MFA.

## Consequences
- Authority changes take effect within one access-token lifetime at worst and immediately on any endpoint
  that reads the stamp — which is all of them.
- A stolen refresh token is usable at most once before detection burns the family.
- Sessions are listable and revocable individually (`/app/settings/security`).
