# QA Fixture System

A demo tenant ("BuildCore Group") with realistic data across every module in
the app, plus a login matrix so QA can get into any role or permission tier
in one click. Two layers:

1. **`prisma/seed.ts`** — the core demo tenant: company/business-group
   structure, named users, projects, tasks, finance, HR, contractors,
   contracts, clients, documents (legacy), assets, HSE reports, procurement
   basics, plus the full **per-role and platform-admin login matrix**.
2. **`scripts/seed-qa-fixtures.ts`** — everything built on top of that core
   this multi-session project: Recruitment, Attendance/Scheduling, Payroll,
   Legal Cases & Holds, HSE Incidents/Inductions/Toolbox Talks/Stop-Work,
   the Workflow Engine, Capability Grants, IT Admin, Mobile & Portal Access,
   the Documents Passport module + Collections, Tasks gap-fill (watch/link/
   recurrence/saved views), Notifications Phase 2-4, Reporting/Analytics
   Phase 2-3, BIM registry, the full Procurement pipeline, Inventory, CRM,
   and Contracts extended (parties/obligations/milestones).

## Running it

```bash
# Fresh database, fully seeded (asks for confirmation — see below):
npm run db:reset:qa

# Or step by step, against a database that already has migrations applied:
npm run db:seed        # core demo tenant (must run first)
npm run db:seed:qa     # everything on top of it

# Both in one go:
npm run db:seed:all
```

`db:reset:qa` runs `prisma migrate reset --force` first — **this destroys
every row in the local database.** Only ever run it against a local dev
database, never anything with real data.

**Idempotent:** `db:seed:qa` is safe to re-run at any time (e.g. after
you've been clicking around and want the fixtures topped back up without
losing your own test data) — each fixture group checks whether its own data
already exists and skips if so. It never re-seeds `prisma/seed.ts`'s core
data; run `db:seed` again yourself if you want that reset too (which means
a full `db:reset:qa` first, since the core seed isn't re-run-safe).

**Environment note:** `db:seed:qa` needs
`NODE_OPTIONS=--conditions=react-server` (already baked into the npm
script) — it imports real `src/server/*.ts` functions directly rather than
duplicating their logic, and those files use the `server-only` marker
package, which throws when required outside Next.js's bundler unless that
condition is set.

## Login matrix

Every account's password is **`1`**.

| Login | Role | What it's for |
|---|---|---|
| `1` | OWNER + Platform Admin | The one account with everything unlocked — cross-tenant `/platform/applications` access plus full in-tenant OWNER access. Start here if you just want to see everything. |
| `arben.kola` | OWNER | Same in-tenant access as `1`, no platform-admin surface. The "named" company owner. |
| `elira.doda` | ARCHITECT | Design Team lead — drawings, RFIs, BIM. |
| `gentian.hoxha` | PM | Project Manager — the default requester/submitter on most seeded records (tasks, workflow instances, procurement). |
| `sara.mema` | ARCHITECT | Second architect — useful for testing "assigned to someone else." |
| `besnik.lala` | STOCK (Site Manager) | HSE observations/inspections, attendance clock-events, inventory movements, asset assignments. Also holds an explicit `hr.compensation.view` capability grant beyond his role default. |
| `fatjon.dervishi` | FINANCE | Finance dashboards, the seeded Finance-stage workflow approval. |
| `ana.krasniqi` | HR | Recruitment, payroll, employee records. |
| `Owner`, `Admin`, `Ceo`, `Pm`, `Architect`, `Engineer`, `Hr`, `Finance`, `Legal`, `Sales`, `Procurement`, `Stock`, `Qaqc`, `Hse`, `Contractor`, `Client`, `Viewer` | one per `ROLES` entry | Pure permission-tier test accounts — no realistic name, just the role. Use these to check "what does this exact role see and not see." |
| `SuperPlatformAdmin`, `PlatformAdmin` | VIEWER + Platform Admin | Cross-tenant `/platform/applications` only, minimal in-tenant access — for testing the Platform Admin surface in isolation. |

Two of the per-role accounts have extra fixture data specifically wired to
them:
- **`Pm`** has a pending workflow approval waiting in `/workflows` (My
  Approvals), and was the approver on a second, fully-decided instance.
- **`Finance`** was the second-stage approver on that same decided workflow
  instance.
- **`Legal`** was explicitly granted access to a `LEGAL_PRIVILEGED` case —
  log in as any *other* LEGAL-role account and it should be invisible
  (404, not 403 — the confidentiality-tier gate at work).
- **`Client`** was added as a member of the "Riverside Holdings" external
  organization with project access granted to Riverside Towers — the one
  account that demonstrates the Client/Supplier Portal access boundary.

## What's seeded, by module

| Module | Route | What to expect |
|---|---|---|
| Recruitment | `/dashboard/hr/recruitment` | 2 vacancies; one candidate hired via an accepted offer (auto-advanced to HIRED), one mid-pipeline, one fresh applicant. |
| Attendance & Scheduling | `/dashboard/hr/attendance` | 2 shifts, 3 site employees assigned to Day Shift, 3 days of real clock-in/out events (worked-hours table populated). |
| Payroll | `/dashboard/hr/payroll` | One **locked** run (last month, calculated + immutable) and one **draft** run (current period) — the two states side by side. |
| Legal Cases & Holds | `/dashboard/legal/cases`, `/dashboard/legal/holds` | One STANDARD-tier dispute (with a hold on it) and one LEGAL_PRIVILEGED case with an explicit access grant. |
| HSE | `/dashboard/hse/*` | A closed near-miss incident with a corrective action, inductions on all 3 projects, toolbox talks, inspections (one with a corrective action), observations, emergency contacts, one issued-and-released stop-work order. |
| Workflow Engine | `/workflows`, `/dashboard/admin/workflows` | One definition (Manager → Finance approval), one fully-decided instance, one pending instance in the `Pm` account's queue. |
| Capability Grants | `/dashboard/admin/roles` | Besnik has `hr.compensation.view`; Gentian has `notifications.emergency_alert.activate` — both beyond their role defaults. |
| IT Admin | `/dashboard/admin/it` | 3 devices, 2 software licences (one with seats assigned), 2 service tickets (one in progress with a comment). |
| Mobile Access | `/dashboard/admin/devices`, `/account/devices` | 3 registered devices across iOS/Android/Web. |
| Portal Access | `/dashboard/admin/portal-access` | Riverside Holdings (client org, `Client` account as member, granted Riverside Towers) + SteelWorks Albania (supplier org, no members yet). |
| Documents (Passport module) | `/documents` | 2 real Document Passport records (one approved, one awaiting approval) in Riverside Towers' folder tree, one with required reading assigned, one shared Collection. |
| Tasks gap-fill | `/tasks/:id` on any task | One task with a watcher, a project link, and a weekly recurrence; 2 saved views on `/tasks`. |
| Notifications | `/announcements`, `/account`, `/dashboard/admin/event-centre` | Policies set, a governed event published, quiet hours + digest rule on Elira, a mandatory-ack announcement, a resolved emergency-alert drill, one simulated external-delivery log entry. |
| Reporting/Analytics | `/analytics`, `/analytics/reports` | 2 report definitions; one execution **issued as a permanent snapshot**, one left live; EUR↔ALL currency rates. |
| BIM | `/dashboard/bim` | One registered model with an IFC version (deliberately **not** glTF/GLB — demonstrates the honest "no live preview" fallback; upload a `.glb` yourself to see the real three.js viewer work). |
| Procurement | `/dashboard/procurement/*` | Full pipeline: purchase request → package → RFQ → quotation → issued PO → scheduled delivery, plus a delivery scheduled against the original seed's structural-steel PO. |
| Inventory | `/dashboard/inventory/*` | 2 products, 2 warehouses, one posted receipt and one posted transfer (real StockBalance, not just the ledger rows). |
| CRM | `/clients/pipeline`, `/clients/leads` | One opportunity in the default pipeline, 2 leads. |
| Contracts (extended) | any seeded contract's detail page | 2 parties, 2 obligations (one in progress, one overdue), 2 milestones (one completed, one pending). |

## Known gaps (not seeded, by design)

- **BIM live 3D preview** — needs a real `.glb`/`.gltf` file, which isn't
  fabricated by the fixtures (see the BIM section above).
- **External notification channels** — `NotificationDeliveryLog` entries
  are `SIMULATED`; no real email/push/SMS is ever sent by this app (no
  provider is configured anywhere), fixtures included.
- **Setup Center / Universal Draft Mode / Import Center** — not built yet
  (see `prd_platform_ui_ux_architecture` in project memory), so there's
  nothing to seed for them.
