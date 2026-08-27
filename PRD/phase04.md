# Construction OS (Nesto) â PRD: Phase 4, Pagination for Unbounded Lists v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 0 (Postgres + CI). Phases 1â3 are independent of this one and don't block it.
**Scope:** no new business modules; this phase adds pagination to the specific lists that will actually grow into a real problem, and deliberately leaves alone the ones that won't.

---

## 0. What I found

I checked every `findMany` call in `src/server/` for whether it's bounded â by a `take`, a date range, or a natural ceiling on row count â versus whether it just pulls a whole table filtered by `tenantId` and nothing else. **130+ list queries across 45 files have no `take` at all**, but that number by itself overstates the problem: most of them are fine. `calendar.ts`'s eight `findMany` calls, for example, all filter by `startAt`/`dueDate` within a `from`/`to` window â naturally bounded, no matter how old the tenant is. The real problem is a specific, identifiable subset: **tables that only ever grow, queried with no bound at all, on pages people load constantly.**

| # | Finding | Evidence |
|---|---|---|
| A | **HSE module: every list function pulls the tenant's entire history.** `src/server/hse.ts` â `listHseReports`, `listPermitsToWork`, `listStopWorkOrders`, `listHseInspections`, `listHseObservations`, `listHseIncidents`, `listHseInductions`, `listHseToolboxTalks` all run `db.<model>.findMany({ where: { tenantId }, include: {...}, orderBy: {...} })` with no date range, no project filter, no `take`. These are records generated continuously (a toolbox talk before every shift, an inspection per site visit) across every project, forever. For a company a year or two into using this, `hse-reports/page.tsx` loads and renders every incident report the company has ever filed, every time anyone opens the page â and each row is `include`-ing related records, making it worse than a plain row count suggests. |
| B | **Finance ledger: the general ledger, by definition, only grows.** `journalEntry.findMany({ where: { tenantId } })` in `finance-module.ts` and `invoice.findMany({ where: { tenantId } })` in `finance.ts` have the same shape. A journal entry table is the textbook case for "this will have tens of thousands of rows within a couple of years of real use" â accounting software doesn't get to skip pagination here. |
| C | **QAQC and Tasks have the same pattern, one tier down in urgency.** `qaqc.ts` (8 unbounded `findMany` calls â inspections, non-conformances) and `tasks-module.ts` (7 â task lists spanning all projects) grow continuously but somewhat more slowly than HSE/finance in a typical company's usage pattern; still real, still needs the fix, just not first. |
| D | **Site photos/renders accumulate the fastest of anything in the system, and their list queries aren't bounded either.** `project-photos.ts`, `project-renders.ts`, `unit-renders.ts` each have one unbounded `findMany`. A single project can generate hundreds of site photos; these are also the heaviest individual rows to page through once Phase 0's Blob migration is in place, since each one now carries a URL fetch on render. |
| E | **What's correctly fine as-is, so this phase doesn't touch it:** `calendar.ts`/`hr-calendar.ts` (date-windowed), project milestones, picklist-style lists (`company-modules.ts`, `capabilities.ts` grants, `hse-emergency-contacts`) which have a natural ceiling in the tens of rows for any real company, and anything already scoped to a single project/entity rather than the whole tenant (e.g., `listHazardsForProject` alongside the unbounded tenant-wide `listHazards` in the same file â worth noting the file already has both patterns side by side, which is exactly the signal that the unbounded ones weren't a deliberate choice, just the ones nobody revisited yet). |

---

## 1. Design decision: offset pagination, not cursor pagination

Cursor-based pagination is the more "correct" answer at real scale â it doesn't degrade as `OFFSET` grows, and it handles rows shifting between pages while someone's scrolling. It's also more code, a different query shape per list, and a UI pattern (infinite scroll or next/prev tokens instead of page numbers) that doesn't fit these table-heavy admin-style pages as naturally. At the row counts this system will actually reach in the near-to-medium term (thousands, not tens of millions), plain `skip`/`take` with a page number is simpler to implement, simpler to reason about, and fits the existing table UI (`Table`/`THead`/`TBody` components already used throughout) without a redesign. Revisit cursor pagination only for a specific list if it's ever measured to be slow at the `OFFSET` sizes actually reached â don't build it pre-emptively for a problem that hasn't shown up yet.

## 2. Shared pagination helper

```ts
// src/lib/pagination.ts
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function parsePageParams(searchParams: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type PaginatedResult<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };
```

One small, reusable UI piece to go with it â a `<Pagination>` component (page number + prev/next, driven by the same `page`/`pageSize` URL search params every affected page will use) rather than a bespoke pager built per page.

## 3. The exemplar change â `listHseReports` and its page

**Server function:**
```ts
// src/server/hse.ts â before
export async function listHseReports(tenantId: string) {
  return db.hseReport.findMany({ where: { tenantId }, include: { project: true, reportedBy: true }, orderBy: { createdAt: "desc" } });
}

// after
export async function listHseReports(tenantId: string, { skip, take }: { skip: number; take: number }): Promise<PaginatedResult<HseReportWithRelations>> {
  const [items, total] = await Promise.all([
    db.hseReport.findMany({ where: { tenantId }, include: { project: true, reportedBy: true }, orderBy: { createdAt: "desc" }, skip, take }),
    db.hseReport.count({ where: { tenantId } }),
  ]);
  return { items, total, page: skip / take + 1, pageSize: take, pageCount: Math.ceil(total / take) };
}
```

**Page:**
```ts
// src/app/(workspace)/hse-reports/page.tsx â signature change
export default async function HseReportsPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const { skip, take, page, pageSize } = parsePageParams(await searchParams);
  const { items: reports, total, pageCount } = await listHseReports(tenantId, { skip, take });
  // ...render `reports` instead of the old unbounded array...
  // <Pagination page={page} pageCount={pageCount} />
}
```

Every other function in the target list (Â§4) gets the identical shape: add `{ skip, take }`, run a paired `count()`, return `PaginatedResult<T>`, update the one page that calls it to read `page`/`pageSize` from `searchParams` and render the `<Pagination>` component.

## 4. Target list, in priority order

| Priority | File | Functions |
|---|---|---|
| 1 | `src/server/hse.ts` | `listHseReports`, `listPermitsToWork`, `listStopWorkOrders`, `listHseInspections`, `listHseObservations`, `listHseIncidents`, `listHseInductions`, `listHseToolboxTalks` |
| 1 | `src/server/finance-module.ts` | `listJournalEntries` (the general ledger â highest long-term row count in the whole system) |
| 1 | `src/server/finance.ts` | the tenant-wide invoice list |
| 2 | `src/server/qaqc.ts` | inspection and non-conformance list functions |
| 2 | `src/server/tasks-module.ts` | tenant/company-wide task list functions (not the already project-scoped ones) |
| 3 | `src/server/project-photos.ts`, `project-renders.ts`, `unit-renders.ts` | the one list function each |

Deliberately not included, per the reasoning in Finding E: `calendar.ts`, `hr-calendar.ts`, milestone lists, picklist-style small tables, and anything already scoped to a single project or entity. Adding pagination to a list that's structurally capped at a few dozen rows is pure overhead with no payoff â resist the urge to apply this pattern everywhere just because the helper now exists.

## 5. Testing

For at least the Priority 1 list, add a test that seeds more than one page's worth of rows (`DEFAULT_PAGE_SIZE + 1` is enough) and asserts `items.length === pageSize` and `total` reflects the true count â this is exactly the kind of off-by-one/forgot-the-`count()` bug that's invisible against the QA seed data (which almost certainly has far fewer than 25 HSE reports per tenant) and only shows up once a real company's data grows past one page.

## 6. Acceptance criteria

- [ ] `src/lib/pagination.ts` and a shared `<Pagination>` component exist and are used by every function/page in Â§4, not five different bespoke implementations.
- [ ] Every Priority 1 and 2 function returns `PaginatedResult<T>` with a real paired `count()`, not an estimate.
- [ ] Corresponding pages read `page`/`pageSize` from `searchParams` and render the pagination control.
- [ ] A test proves pagination actually limits and counts correctly for at least the HSE list (the exemplar) â extend to the rest of Priority 1 as the pattern is copied over.
- [ ] Nothing in Finding E's "leave alone" list was touched.

## 7. Sequencing

```
Helper + exemplar (HSE reports)  âââ do first; this is the piece that
                                      proves the pattern end-to-end
Finance ledger + invoices        âââ second â highest row-count risk
Remaining Priority 1 (HSE)       âââ copy the proven pattern across the
                                      other 7 functions in the same file
Priority 2 (QAQC, Tasks)         âââ same pattern, lower urgency
Priority 3 (photos/renders)      âââ same pattern, lowest urgency
```

## 8. Definition of Done for Phase 4

- [ ] All Priority 1 lists are paginated and tested.
- [ ] Priority 2 and 3 lists are paginated (may ship as a fast follow-up within the same phase rather than blocking on Priority 1, since the pattern is identical).
- [ ] No naturally-bounded list was given pagination it doesn't need.
- [ ] Zero new business features shipped during this phase.

## 9. What comes next (not in scope here)

Cursor-based pagination for any specific list that's later measured to be slow at the `OFFSET` values it actually reaches (not pre-emptively); filtering/search controls on the now-paginated HSE and finance lists, since a paginated but unfilterable list of thousands of incident reports is only half the fix from a real user's point of view; and the same audit applied to the components/pages layer (some client-side data-table components may independently be rendering full arrays passed down from a page that's now paginated correctly at the query level â worth a follow-up check that the fix reaches all the way to the browser).
