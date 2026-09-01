> Chat: Nesto ERP Audit · File: Nesto_Navigation_IA_Audit_v1.1.md · Continuation of v1.0 — the modules v1.0 didn't reach, code-verification of its open questions, and four findings that reorder its plan · Last updated: 2026-09-01

# Nesto — Navigation & IA Consolidation Audit v1.1 (continuation)

**How this continues v1.0.** v1.0 read `nav-config.ts` and reasoned about structure. v1.1 went into the route tree, the page files, the models and the permission matrix and checked the claims. Section numbering continues from v1.0 (§10 onward). Where v1.0 was right I say so and move on; where the code disagrees I say that too, with the check that produced it.

The headline: **the consolidation plan in v1.0 is sound, but it is not the most urgent thing in this file.** Four things the nav-config reading could not see change the order of work.

---

## 10. Baseline, re-measured from the code

| | v1.0 | v1.1 (measured) | |
|---|---|---|---|
| Nav items | 243 | **242** | rounding, not a disagreement — per-module counts match v1.0 exactly |
| Unique destinations | — | **205** | so 37 items are the same destination reached from another sidebar |
| `page.tsx` files in the app | — | **271** | |
| Nav links that resolve to a real page | — | **178 of 205** | |
| Route depth | — | 137 destinations at depth 3, 24 at depth 4 | relevant to §16 |

v1.0's per-workspace table reproduces exactly (Finance 33, QAQC 28, Procurement 28, Executive 27, HR 26, Admin 22, Inventory 15, Sales 15, Engineering 14, Architect 12, HSE 12, Legal 8, Contractor/Portal 1). That table is reliable; build on it.

---

## 11. QAQC: 27 of its 28 nav items are dead links

This is the finding that reorders the plan.

```
src/app/(workspace)/dashboard/qaqc/
└── page.tsx        ← the only page in the entire QAQC subtree
```

The QAQC sidebar advertises 28 destinations. **One exists.** The other 27 — every Quality Planning item, every Inspections item, every Quality Issues item, all nine Handover items, My Work, Alerts, Reports, Settings — have no `page.tsx` behind them. They are not disabled in Platform Configuration either (`platform-config.ts` has zero `qaqc` entries), so `visibleNavSections()` does not strip them. A QAQC user clicking anything but "Dashboard" gets a 404.

It goes one level deeper than the sidebar. The QAQC dashboard's own six StatTiles link to `/dashboard/qaqc/inspections`, `/ncrs`, `/defects`, `/corrective-actions` and `/handover` — five of the six tiles are dead too.

And the work is half-done in a way that's easy to miss:

- `src/server/qaqc.ts` (383 lines) + `src/app/actions/qaqc-quality.ts` (157) + `src/app/actions/qaqc.ts` (106) — real, working server logic
- `src/components/qaqc/` — `create-ncr-dialog.tsx`, `create-defect-dialog.tsx`, `ncr-stage-actions.tsx`, `defect-actions.tsx`, all four **imported by nobody**

So the NCR and Defect features are built end-to-end except for the page that mounts them. `git log` confirms the QAQC pages were never committed — this isn't a regression, it's an unfinished build with a finished sidebar in front of it.

**What this does to v1.0 §3.** v1.0 proposes consolidating QAQC's 28 items to 16–18, with the Handover group becoming a stepper. That analysis is still the right target — but it is a **specification for a build, not a refactor of existing pages.** There is nothing to consolidate. Reframed that way it's actually good news: QAQC is the one module where the consolidated IA can be built correctly the first time, with no migration cost. It should move from "step 5, do the stepper last" to "the place where the tabbed-page pattern gets proven," because it's the only module where the pattern costs nothing to adopt.

---

## 12. The inverse problem: working pages with no way in

While 27 nav items point at nothing, **21 real pages inside the workspace are in no sidebar at all.** Most are fine — they're reached from a sub-nav on their parent page (§13). Two are not reachable from anywhere:

```
/dashboard/finance/cash-flow    Cash Flow  — 0 inbound links in the entire codebase
/dashboard/finance/budget       Budget vs Actual — 0 inbound links
                                (the 7 apparent references are all to /budgets, plural,
                                 which is a different page and is in the sidebar)
```

Both are complete: real `FINANCE:READ` gate, real server query (`getFinanceDashboardData`, `getBudgetVsActualByProject`), charts, i18n. Cash Flow and Budget vs Actual are two of the most-wanted views in any finance module, and in a module with **33 sidebar items** neither has one. That is the sharpest single illustration of the thesis in this audit: the problem was never item count. It's that the sidebar is not a map of the product.

The other 19 orphans are reachable via a parent page's sub-nav — Assets (5), Work Progress (6), Admin IT (3), Documents Collections/Storage (2), Analytics Reports, Inventory Movements, Procurement Workspace — which brings us to the real structural finding.

---

## 13. Two competing navigation idioms, six hand-rolled implementations

v1.0 §9 asks whether the tabbed-page pattern is cheap to adopt. **It's already adopted — six times, independently, with no shared component.**

| Component | Items | Labels |
|---|---|---|
| `procurement/procurement-nav.tsx` | 9 | hardcoded English |
| `assets/assets-nav.tsx` | 6 | hardcoded English |
| `work-progress/work-progress-nav.tsx` | 7 | hardcoded English |
| `dashboards/project-finance-tabs.tsx` | — | hardcoded English |
| `dashboards/architect-project-tabs.tsx` | — | i18n'd (10 `t()` calls) |
| `dashboards/engineering-project-tabs.tsx` | — | i18n'd (11 `t()` calls) |

All six render the same thing: a horizontal pill row of `<Link>`s with an `active` prop, `overflow-x-auto`, `rounded-xl border border-border bg-surface p-1.5`. Three also ship a near-identical page header (`ProcurementPageHeader`, `AssetsHeader`) with the same gold eyebrow / 2xl title / muted description.

Two consequences worth acting on:

1. **The platform has two answers to "where do a module's sections live."** Assets and Work Progress put them on the page and have **zero** sidebar items each. Procurement has a `ProcurementNav` with 9 sections *and* 28 sidebar items covering the same ground. A user in Procurement sees the same destinations twice, in two different chrome, at the same time. That's not a count problem, it's an unresolved decision.
2. **Four of the six bypass i18n entirely.** The sidebar is 100% `labelKey`-driven and guarded by `tests/unit/i18n-coverage.test.ts`; these sub-navs are raw English strings that the test doesn't see. Every consolidated page v1.0 proposes adds more of this surface. Build the shared component with `labelKey` in its contract, or the consolidation quietly un-localises the product.

**This upgrades v1.0 §6's recommendation.** The primitive list isn't `Dialog, EmptyState, Skeleton` — it's `SubNav` and `PageHeader` first, because those are the ones already duplicated six times and already drifting.

---

## 14. The modules v1.0 didn't reach

### 14.1 Executive (27) — a launcher, and the launcher is a trap

11 of Executive's 27 items are links into other modules' consoles. That's defensible for a CEO. What isn't: **clicking four of them destroys your sidebar.**

`workspaceKeyFromPath()` hands you another department's shell when you hold that department's resource at `FULL`. Against the CEO row of `PERMISSION_MATRIX`:

```
CEO clicks "Finance"      → FINANCE:FULL      → dropped into Finance's 33-item shell
CEO clicks "Procurement"  → PROCUREMENT:FULL  → dropped into Procurement's 28-item shell
CEO clicks "Legal"        → LEGAL:FULL        → dropped into Legal's shell
CEO clicks "CRM"          → CLIENTS:FULL      → dropped into Sales' shell
CEO clicks "HR"           → HR:READ           → keeps the Executive shell
CEO clicks "HSE"          → HSE_REPORTS:READ  → keeps the Executive shell
CEO clicks "Administration" → USER_MANAGEMENT:NONE → keeps the Executive shell
```

Seven links in one sidebar group; four swallow your workspace and three don't, on a rule the user cannot see or predict. There is no workspace switcher in the topbar and no "back to Executive." The behaviour itself is correct and deliberately built (PRD_5, and the comment block explaining it is careful and right) — the gap is that **nothing in the UI tells you it happened or offers a way back.**

Also in Executive, the same duplication shape v1.0 found in Payroll:
- `HSE Reports → /hse-reports` and `HSE → /dashboard/hse`, adjacent, in the same group
- `HR → /dashboard/hr`, `Payroll → /dashboard/hr/payroll`, `My Payslips → /dashboard/hr/payroll/my-payslips` — three entries into one subtree
- `Tasks → /tasks` and `Task Orchestration → /tasks/orchestration` — orchestration is a view of tasks, not a sibling of them
- `Reports` and `Analytics` (v1.0 §5.1 already has this)

### 14.2 Admin (22) — one section is a 14-item settings drawer

Admin's "Company Settings" group holds 14 items: Company Profile, Subscription, Platform Configuration, Integrations, Security, Audit Logs, Event Centre, Workflow Definitions, IT Admin, Device Access, Portal Access, Domain Events, Import Center, Setup Center. Flat, unordered, no internal grouping. It's the same lifecycle-as-menu pattern as HR's People, but for configuration, and at 14 wide it's the single longest ungrouped run in the platform.

A grouping that matches how the work is actually done:
```
Access        Users · Roles · Teams · Invitations · Device Access · Portal Access
Configuration Platform Config · Workflow Definitions · Setup Center · Import Center · Integrations
Observability Audit Logs · Domain Events · Event Centre
Company       Company Profile · Subscription · Security · IT Admin
```

One naming collision to fix while in there, verified as *not* a data duplication: `/dashboard/admin/devices` lists **mobile access sessions** (`listAllDevicesForTenant`, `mobile-access`), `/dashboard/admin/it/devices` lists **IT hardware assets** (`listItDevices`, `it-admin`). Genuinely different things, both called "Devices," gated on different resources. Rename, don't merge — "Device Access" vs "IT Hardware."

### 14.3 Inventory (15) — the consolidation target is already built and unlinked

The "Operations" group is five items — Receiving, Goods Issues, Transfers, Returns, Reservations — which are five movement types over one append-only stock ledger (the PRD's own model). Textbook v1.0 §2-Cluster-B shape: one destination, tabbed by movement type.

And **`/dashboard/inventory/movements` already exists**, is not in the sidebar, and is linked from the product detail, transfers and receiving pages. The unified view is built. It needs promoting to the nav and the five type-specific pages becoming its tabs.

### 14.4 Sales (15) — a funnel split into four destinations

`Leads · Opportunities · Sales Pipeline · Reservations` are four nav items over one funnel; Pipeline is a *board view of Opportunities*, not a different entity. `Clients · Contacts` are a record and its children. Proposed: `Clients` (tabbed: directory / contacts) and `Pipeline` (tabbed: leads / opportunities / board / reservations). 15 → 11.

### 14.5 Architect (12) + Engineering (14) — the real duplication in this platform

v1.0 §5.2 looked at Drawings vs Specifications vs Documents and flagged it "verify, then likely fine as-is." **Verified — and the answer is the other way around on both halves.**

*Drawings/Specifications/Documents are not the same system.* `Drawing` and `Specification` are independent Prisma models with **no relation to `DocumentFile` at all** — not subtypes of it. They already share the component layer that matters (`Card`, `Table`, `Badge` in all three). So there's no duplication to consolidate. What there is instead is **capability drift**: Documents has folders, revisions, versioning, starring, bulk archive and the Passport; `Drawing` has a `DrawingRevision` table; `Specification` has a `currentRevision` string and **no revision history model whatsoever**. Same class of artefact, three different levels of governance. That's a data-model finding for the Documents track, not a nav finding — and v1.0's "likely fine as-is" verdict on the *navigation* holds.

*The actual duplication is next door, and the code admits it.* Architect and Engineering each have their own RFIs, Submittals and Approvals pages — six routes — and both call **the same functions from the same module**:

```
architect/rfis/page.tsx        → listRfis      from @/server/architecture
engineering/rfis/page.tsx      → listRfis      from @/server/architecture
architect/submittals/page.tsx  → listSubmittals from @/server/architecture
engineering/submittals/page.tsx→ listSubmittals from @/server/architecture
```

The engineering pages even carry comments saying so: *"Same Submittal source as Architecture (§19 'shared by Architecture & Engineering') — one register, no duplicate record type."* One register, correctly. But two hand-maintained renderings of it, and they have drifted into a **functional split**:

| | Architect's RFI page | Engineering's RFI page |
|---|---|---|
| Create an RFI | ✅ `CreateRfiDialog` | ❌ |
| Respond to an RFI | ❌ | ✅ `RespondToRfiForm` |
| Filter by open/overdue | ✅ `?status=open` | ❌ |
| Due date column | ✅ | ✅ |
| Response text shown | ❌ | ✅ |

Submittals diverge the same way (Architect shows the Submitter column, Engineering doesn't; each links to a different project detail route). This isn't cosmetic: **an architect structurally cannot answer an RFI and an engineer structurally cannot raise one**, because of which page they were given, not because of a permission. One `<RfiRegister scope={...}>` used by both routes fixes the drift and closes the capability gap in the same change. This is the highest-value consolidation in the audit — it removes 3 destinations *and* fixes behaviour.

### 14.6 HSE (12) and Legal (8) — v1.0's verdict holds, with one nit

No lifecycle-stage-as-menu-item pattern in either; no forced consolidation. One nit: HSE's eight safety items sit in a single flat "Safety" run, and HSE carries the same double entry Executive does — `HSE Reports → /hse-reports` and `Overview → /dashboard/hse`.

---

## 15. No breadcrumbs, anywhere

`grep -rli breadcrumb src` returns **nothing.** 205 destinations, 137 of them three levels deep and 24 four levels deep, a sidebar that swaps out from under you (§14.1), and no persistent answer to "where am I / how do I get back."

Every consolidation in this audit makes this *more* acute, not less: a tabbed Employees page means the URL and the tab state now carry meaning the sidebar no longer shows. **A breadcrumb is a prerequisite for the tabbing work, not a follow-up to it.**

---

## 16. Nav gates vs page gates — the invariant the file claims is not held

`nav-config.ts` states its own contract in a comment:

> `resource`/`level` mirror the exact `can(role, resource, level)` gate the destination page enforces — kept in lockstep on purpose so the sidebar never advertises a link a role would immediately get redirected away from.

Diffing every nav item's declared gate against its page's actual `can()` redirect: **18 divergences.** Most are latent (the roles that see the item happen to satisfy both gates today). One is live:

```
/dashboard/inventory/settings
  nav declares  PROCUREMENT : READ
  page enforces PROCUREMENT : FULL
  STOCK role has PROCUREMENT : WRITE
```

STOCK is the only role whose home is the Inventory console. It sees "Inventory Settings" in its own sidebar, clicks it, and is redirected back to `/dashboard/inventory`. The module's owner is bounced out of the module's settings.

The rest — `hr/disciplinary` and `hr/settings` (nav READ, page FULL), `finance/assets` (nav gates `PROJECTS`, page enforces `FINANCE`), `clients/payments` (nav gates `FINANCE`, page gates `CLIENTS`), and 13 more — don't misbehave today only because of the current matrix. They will the first time a role's row changes.

**Nothing tests this.** There is no test asserting that every nav `href` resolves to a `page.tsx`, and none asserting nav gate == page gate. Two tests of maybe 20 lines each would have caught all 27 dead QAQC links and all 18 gate divergences at commit time, and would keep the consolidated IA honest as it's built. Given `tests/unit/i18n-coverage.test.ts` already exists for exactly this reason on exactly this file, the precedent is set.

---

## 17. Corrections to v1.0 §6 (visual)

- **"~10 separate hand-rolled dialog implementations" — it's 88 files.** 89 files contain a modal overlay; 88 of them import `@radix-ui/react-dialog`. So the good news first: this is *not* fragmented across competing libraries, it's one library used 88 times. The bad news is the scale — every one of those 88 re-declares its own `Dialog.Content` class string. Sampling them: 56 use `max-w-sm` with no scroll, 11 add `max-h-[85vh] overflow-y-auto`, 5 use `max-w-md`, 5 `max-w-lg`, and there are one-off `max-w-2xl`, `z-[60]`, `max-h-[90vh]` and `w-[94vw]` variants. A single `<Dialog>` primitive with size variants collapses all 88. v1.0's recommendation is right; its estimate was 8× low.
- **"No shared Empty/Loading/Error state components" — confirmed.** `components/ui/` has 18 entries; there is no `empty-state`, `skeleton` or `error-state`. Worth noting the near-misses that already exist and should inform the API rather than be duplicated: `access-denied.tsx`, `coming-soon.tsx`, `scope-stub.tsx`.
- **`@radix-ui/react-tabs` is already a dependency and is used exactly once** (`task-orchestration-view.tsx`). The tabbing work in §1–4 has its primitive already installed and paid for.
- **Add to the primitive list:** `SubNav` and `PageHeader` (§13), and `Breadcrumb` (§15).

---

## 18. Revised sequencing

v1.0's order was right for a codebase where all the pages exist. Three of them don't, one module is a build rather than a refactor, and two safety nets are missing. Revised:

```
0. Two tests, first — nav href resolves to a page; nav gate == page gate.
   ~40 lines. They fail immediately on 27+18 existing violations, which is
   the point: they turn §11 and §16 into a checklist instead of a memory.

1. Shared primitives — SubNav, PageHeader, Breadcrumb, Dialog, EmptyState,
   Skeleton. SubNav/PageHeader first (6 existing duplicates), Breadcrumb
   before any tabbing (§15). Radix Tabs is already installed.

2. Triage what's broken before consolidating what works:
   a. Link Cash Flow and Budget vs Actual — two finished pages, zero
      inbound links, highest value-per-minute in the whole audit  (§12)
   b. Fix /dashboard/inventory/settings' gate — live dead-end for STOCK (§16)
   c. Promote /dashboard/inventory/movements to the nav (§14.3)

3. Architect/Engineering RFI + Submittal + Approval register — one shared
   component, two scoped routes. Removes 3 destinations AND closes a real
   capability gap in both directions. (§14.5)

4. QAQC — build it to the v1.0 §3 target IA directly. It's the only module
   where the consolidated shape costs nothing, because nothing exists yet.
   Proves the tabbed pattern and the Handover stepper on greenfield. (§11)

5. HR People consolidation — v1.0's step 2, unchanged, now with the
   primitives and the pattern already proven. (v1.0 §1)

6. Finance — Transactions cluster, Connected Finance, Payroll. (v1.0 §2)

7. Procurement — Orders, Suppliers, and resolve the sidebar-vs-ProcurementNav
   double navigation while in there. (v1.0 §4 + §13)

8. Executive/Admin regrouping + a workspace switcher or "back to Executive"
   affordance for the shell swap. (§14.1, §14.2)

9. Sales funnel; Reports & Analytics hub. (§14.4, v1.0 §5.1)
```

---

## 19. v1.0 §9's open questions, answered

**"Do the pages to be tabbed already share enough structure to tab together cheaply?"**
Yes, and cheaply. Every page checked imports the same `Card` / `Table` / `Badge` / `getT` / `can()` skeleton, and they're small: HR's four People pages total 247 lines; Finance's five Receivables/Payables/Invoices/Bills/Payments pages total 318; Connected Finance's five total 333. The heaviest single page in any of those clusters is 89 lines. These are thin server components over distinct queries — tabbing them is moving a query call and a table body under a shared shell, not a rewrite. The one caveat: Receivables and Payables are 31 lines each while Invoices/Bills/Payments are 79–89, so the tab set will be visibly uneven in content weight until Receivables/Payables grow.

**"Is the Reports & Analytics hub a replacement or a directory?"**
The audit's assumption (a front door, not a replacement) is the right one, and there's now a concrete reason: `/analytics/reports` already exists as an unlinked page, and every module's `Reports` leaf is a distinct page against a distinct server query. A hub that replaces them would mean rewriting eight query surfaces; a hub that indexes them is a page of links plus cross-module filters. Build the directory.

---

## 20. What v1.1 does not change

Everything in v1.0 §1, §2, §4 stands as written — those clusters are real, the pages exist, and the proposed shapes are right. Contractor and Portal stay at 1 item. Legal stays at 8. And the Drawings/Specifications/Documents question is now closed in v1.0's favour on navigation grounds (§14.5) — the finding that came out of verifying it belongs to the Documents data-model track instead.
