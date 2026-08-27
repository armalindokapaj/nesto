# Construction OS (Nesto) â PRD: Phase 8, Executive Dashboard Exposure v1.0

**Status:** Draft for implementation â **treat as highest priority of the whole review series so far**
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 6's `accessibleProjectIdFilter()` helper
**Scope:** one function, one page â but this is the most consequential finding across Phases 1â8, because of *when* it fires, not just what it exposes.

---

## 0. Why this one jumps the queue

Every prior scoping fix (Phases 1, 6, 7) required a `CLIENT` user to take an action â open the projects list, run a search. This one doesn't. `DASHBOARD_BY_ROLE` in `src/lib/permissions.ts` routes both `CLIENT` and `VIEWER` to `/dashboard/executive` â **the same landing page as `OWNER`, `CEO`, and `PM`.** That page calls `getExecutiveDashboardData(tenantId, canViewFinance)` in `src/server/executive.ts`, which returns, with zero project scoping:

```ts
export async function getExecutiveDashboardData(tenantId: string, canViewFinance: boolean) {
  const [projects, invoices, tasks, childCompanies] = await Promise.all([
    db.project.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    canViewFinance ? db.invoice.findMany({ where: { tenantId } }) : Promise.resolve(null),
    db.task.findMany({ where: { tenantId, status: { in: ["REVIEW", "APPROVED"] } } }),
    db.company.count({ where: { tenantId, isParent: false } }),
  ]);
  // ...
  return {
    activeProjectCount: activeProjects.length,      // whole tenant
    pendingApprovals: tasks.length,                  // whole tenant
    risks: /* at-risk + delayed project count */,    // whole tenant
    projects: activeProjects.slice(0, 5),            // whole tenant's actual project records
    // revenue/cashFlowSeries correctly gated â see below
  };
}
```

**This is what a `CLIENT` sees the moment they log in** â before they click anything: the company's total active project count, up to five real project names/details from across the whole tenant (not necessarily theirs), how many tasks are pending approval company-wide, and how many projects are at risk or delayed company-wide. No search query, no URL guess, no navigation required. This is strictly more exposed than the search bar (Phase 7) or the project list (Phase 1), because those need the user to go looking; this one hands it to them.

**One thing worth crediting, because it shows the fix pattern was already known and half-applied:** `revenue` and `cashFlowSeries` *are* correctly gated â the function takes a `canViewFinance` boolean and returns `null` for both when it's `false`, with a code comment explicitly calling this out as "Audit C1" and explaining the null-at-the-query-layer discipline. Whoever wrote this function got the finance gating right and simply didn't extend the same discipline to `projects`/`tasks` â there's no comment anywhere near those fields suggesting it was a deliberate choice, unlike the employee-directory precedent seen in Phase 7. This reads as an oversight in an otherwise careful function, not a considered decision.

---

## 1. The fix

### 1.1 Scope the query, following the exact pattern from Phases 6 and 7

```ts
// src/server/executive.ts
import { accessibleProjectIdFilter } from "@/lib/project-access";
import type { Role } from "@/lib/constants";

export async function getExecutiveDashboardData(
  tenantId: string,
  canViewFinance: boolean,
  role: Role,
  userId: string
) {
  const projectIds = await accessibleProjectIdFilter(tenantId, role, userId);
  const projectWhere = { tenantId, ...(projectIds ? { id: { in: projectIds } } : {}) };

  const [projects, invoices, tasks, childCompanies] = await Promise.all([
    db.project.findMany({ where: projectWhere, orderBy: { createdAt: "desc" } }),
    canViewFinance ? db.invoice.findMany({ where: { tenantId, ...(projectIds ? { projectId: { in: projectIds } } : {}) } }) : Promise.resolve(null),
    db.task.findMany({ where: { tenantId, status: { in: ["REVIEW", "APPROVED"] }, ...(projectIds ? { projectId: { in: projectIds } } : {}) } }),
    // childCompanies (subsidiary count) is a company-structure figure, not
    // project data â leave it as a tenant-wide count for internal roles,
    // but see 1.3 for whether CLIENT should see it at all.
    db.company.count({ where: { tenantId, isParent: false } }),
  ]);
  // ...rest unchanged...
}
```

### 1.2 Update the one call site

```ts
// src/app/(workspace)/dashboard/executive/page.tsx
const { tenantId, role, user } = await getCurrentUser();
const canViewFinance = can(role, "FINANCE", "READ");
const data = await getExecutiveDashboardData(tenantId, canViewFinance, role as Role, user.id);
```

### 1.3 The bigger question this fix surfaces, worth deciding explicitly rather than patching around

Scoping the query closes the data leak, but it leaves an odder outcome in place: `CLIENT` and `VIEWER` will now see an "Executive Dashboard" â literally labeled and shaped for company leadership â showing metrics scoped to just their own one or two projects. `subsidiaryCount`, in particular, is a company-structure figure with no project scoping available at all (a client has no legitimate reason to know how many subsidiary companies the tenant has) â should probably be dropped from what's shown to `CLIENT`/`VIEWER` entirely rather than scoped, since it can't be scoped meaningfully.

This is the same kind of decision Phase 1 flagged and deliberately didn't resolve for `VIEWER`'s ambiguity â I'd make the same call here: **fix the data leak now** (this phase), and treat "should CLIENT/VIEWER have their own dashboard route instead of sharing Executive's" as a separate, explicit product decision, not something to design mid-security-fix. A purpose-built `/dashboard/client` (project status, their documents, their contract) would be the better long-term answer and is a natural candidate for a future phase â but scope creep here (redesigning the dashboard while trying to patch a data leak) is exactly the kind of thing that turns a one-file fix into a multi-week detour. Patch first, redesign later, on purpose.

---

## 2. Testing

Same shape as Phase 6/7's tests: seed a `CLIENT` with access to one project among several in a tenant, load the executive dashboard data for that user, and assert `activeProjectCount`, `projects`, `pendingApprovals`, and `risks` all reflect only their one project â not the tenant total. This is the highest-value test in the whole review series to actually write and run before shipping, given this is the first-screen exposure.

## 3. Acceptance criteria

- [ ] `getExecutiveDashboardData()` takes `role`/`userId` and scopes `projects`/`invoices`/`tasks` via `accessibleProjectIdFilter()`, matching Phase 6/7's established pattern.
- [ ] A `CLIENT` or `VIEWER` (once Phase 1's VIEWER decision is made) logging in sees only their own accessible projects' figures â verified by the test in Â§2, not just by inspecting the code.
- [ ] `subsidiaryCount` is either dropped from the response for `CLIENT`/`VIEWER` or explicitly decided to stay (Â§1.3) â not left as an unscoped number by default.
- [ ] The finance gating that was already correct (`revenue`/`cashFlowSeries` null-at-query-layer for non-finance roles) is unchanged and unbroken by this edit.

## 4. Definition of Done for Phase 8

- [ ] The executive dashboard no longer exposes tenant-wide project/task data to `CLIENT`/`VIEWER` sessions.
- [ ] A decision is recorded (even if the decision is "defer") on whether `CLIENT`/`VIEWER` should eventually get a dedicated dashboard route rather than a scoped view of Executive's.
- [ ] Zero new business features shipped during this phase.

## 5. What comes next (not in scope here)

A dedicated `CLIENT`-facing dashboard (project status, their own documents, contract summary) if Â§1.3's decision goes that way â this is genuinely a small, well-scoped feature at this point, not a big lift, since the data-fetching functions it would need (`listAccessibleProjectIdsForUser`, the now-scoped project/task queries) all already exist. And, echoing Phase 7's closing note: the same "does this dashboard's data-fetcher accept a role/scope parameter, or does it assume internal-only tenant-wide access" check is worth running against every other role-specific dashboard (`dashboard/finance`, `dashboard/hr`, etc.) even though those aren't reachable by `CLIENT`/`CONTRACTOR` today â the Executive dashboard wasn't reachable-by-design either, in the sense that nobody seems to have intended external roles to land there with unscoped data; it just happened because of how `DASHBOARD_BY_ROLE` was wired. Worth confirming that wiring is exactly right for every role, not just assuming it is because the route names sound role-appropriate.
