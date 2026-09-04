# ADR-0014 — Feature/module registry and company variations

**Status:** Accepted · 2026-09-04 · PRD §10.4, §12.10, §23.2, Appendix D.14

## Context
Navigation, routes and capabilities must be feature-, lifecycle- and permission-aware, with hidden modules
*absent* rather than disabled — while configuration must never be able to weaken security.

## Decision
- **Typed module registry** in `packages/contracts`: every module declares id, route base, required
  permission keys, required feature flag, supported audiences and navigation metadata. Navigation is
  generated from the registry; there is no hand-maintained menu that can drift from the guards.
- **Route guard remains authoritative.** Hiding a nav item is presentation. The guard order of §23.4 runs
  regardless of how the URL was reached.
- **`FeatureAssignment`** targets a tenant, a company or a module and carries an enablement state and an
  optional rollout window. Resolution follows §10.4's precedence: protected Nesto default → published
  platform version → Platform Admin company variation → project configuration where explicitly allowed →
  user preference for presentation and delivery only.
- **A lower layer may never** weaken security, retention, protected states, audit, required approvals or
  data ownership. The resolver enforces this by construction: variation payloads are validated against a
  schema that simply has no field for those things.
- **Template variations** are Platform-Admin-owned and based on a published, immutable `TemplateVersion`.
  Companies cannot author templates or scripts in this baseline (§9.5).

## Consequences
- Adding a module is a registry entry plus its permissions; nav, guards and the platform's module list
  update together.
- A misconfigured flag can hide a feature. It cannot expose one, because the flag is evaluated after
  permission, not instead of it.
