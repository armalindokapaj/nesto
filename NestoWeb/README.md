# Nesto

Private, multi-tenant operating system for construction companies — Phase 0/1
foundation (auth, tenant/company structure, roles & permissions, projects,
tasks, and five role-specific dashboards) built from the Construction OS
Master PRD. See `/Users/mnrv/.claude/plans/toasty-percolating-horizon.md` for
the full scope decisions, what's included in this pass, and what's explicitly
deferred to later phases.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Prisma
(SQLite for local dev) · custom session auth (`jose` + bcrypt, no third-party
auth library) · Recharts 2 · Radix UI primitives.

## Getting started

```bash
npm install
npm run db:migrate     # applies the Prisma schema to a local dev.db (SQLite)
npm run db:seed        # seeds a demo tenant ("BuildCore Group") with realistic data
npm run dev            # http://localhost:3000
```

Demo logins (all use password `Nesto2026!`):

| Username | Role |
|---|---|
| `arben.kola` | Company Owner (executive + admin dashboards) |
| `elira.doda` | Architect |
| `fatjon.dervishi` | Finance |
| `ana.krasniqi` | HR |

## Scripts

- `npm run dev` / `build` / `start` — Next.js
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run db:migrate` / `db:push` / `db:studio` / `db:reset` — Prisma
- `npm test` / `test:watch` — Vitest unit tests (permission matrix, tenant scoping)
- `npm run test:e2e` — Playwright end-to-end tests (auth, role gating, responsive layout)

## Notes for whoever picks this up next

- **Database**: SQLite locally by design (no Docker/Postgres available in the
  build environment) — every tenant-owned model carries a `tenantId` column,
  so switching `datasource.provider` to `postgresql` in `prisma/schema.prisma`
  is a config change, not a schema rewrite.
- **Auth**: custom cookie-based sessions (`src/lib/session.ts`, `src/lib/dal.ts`)
  rather than next-auth/Auth.js — it's a v5 beta with unproven compatibility
  against Next.js 16's new `proxy.ts` convention and React 19.2; the custom
  layer follows Next's own documented auth pattern and is much smaller surface
  area to audit.
- **Permissions**: `src/lib/permissions.ts` holds the full role/resource matrix
  (coarse section-level gating). Per-record rules (e.g. "contractor sees only
  their own contract") are not implemented yet — that's Phase 2+ work per module.
- **Charts**: pinned to Recharts 2.x rather than the new 3.x line, for stability.
