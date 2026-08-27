# Construction OS (Nesto) â PRD: Phase 6, Reconciling Access Scoping with Pagination v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 1 (CLIENT project scoping) and Phase 4 (list pagination) â this phase exists specifically because those two, implemented exactly as written, don't compose correctly.
**Scope:** no new business modules; this is a correction pass on two earlier PRDs before their patterns get copied any further.

---

## 0. What I found â and why this is a "before you copy the pattern further" phase, not a new problem

This one isn't a fresh discovery in the codebase â it's a conflict between two of this project's own prior specs that I want to flag before more code gets written against either one.

**Phase 1, Track A** fixed `CLIENT`-role project visibility with a deliberately simple post-fetch filter:
```ts
export async function scopeToAccessibleProjects<T extends { projectId: string | null }>(
  tenantId: string, role: Role, userId: string, rows: T[]
): Promise<T[]> {
  if (role !== "CLIENT") return rows;
  const accessibleIds = new Set(await listAccessibleProjectIdsForUser(tenantId, userId));
  return rows.filter((r) => r.projectId !== null && accessibleIds.has(r.projectId));
}
```
That PRD explicitly flagged this as the fast, low-risk version and said: *"Flag any list that's large enough for this to matter... for a follow-up query-level optimization â don't block this phase on it."* This phase is that follow-up, and it turns out to not be optional once Phase 4 is in the picture.

**Phase 4** added DB-level `skip`/`take` pagination to exactly the kind of tenant-wide list functions Track A's filter was meant to sit in front of â `tasks-module.ts` is named in *both* PRDs: Phase 1 lists it as needing CLIENT scoping, Phase 4 lists its "tenant/company-wide task list functions" as a Priority 2 pagination target.

**Here's the actual bug if both ship as literally specified:** filtering *after* the database has already applied `LIMIT`/`OFFSET` is wrong. If a `CLIENT` user has access to 3 of a tenant's 200 tasks, and those 3 happen to fall on what would be "page 4" before filtering, a paginated query that fetches `take: 25` at `skip: 0` and then post-filters down to the client's accessible rows returns **zero results on page 1** â not because there's nothing to show, but because the filter ran after the page boundary already cut them out. The `total`/`pageCount` numbers Phase 4 introduced would also be wrong, since `count()` counts the whole tenant, not what this client can actually see. This isn't a rare edge case â it's the expected outcome for almost any real `CLIENT` user, since by definition they have access to a small subset of a tenant's full data.

| # | Where this bites | Current state |
|---|---|---|
| A | `src/server/tasks-module.ts` | Named in both PRDs. Whichever ships second will silently break the other's fix unless this phase happens first. |
| B | `src/server/contracts.ts` | 2 `findMany` calls, 0 `take` â unbounded, and `CONTRACTS: "READ"` is one of `CLIENT`'s coarse grants per Phase 1's own permission-matrix reading. This wasn't on Phase 4's list (it predates that audit) but has the identical shape and needs the same fix, not a separate one. |
| C | `src/server/documents.ts` / `documents-module.ts` | Partially paginated already (1 `take:` each, out of 5 and 12 `findMany` calls respectively) â worth auditing which of those `take`-less calls are the ones a `CLIENT` (who has `DOCUMENTS: "READ"`) would actually hit, since a mixed file is exactly where this kind of bug hides. |

---

## 1. The fix: push the accessible-ID filter into the query, not after it

### 1.1 Target state

`scopeToAccessibleProjects()` as a post-fetch filter is retired for any list that is or will be paginated. In its place, every affected list function takes the caller's accessible-project-ID set as a `where` input, the same way it already takes `tenantId` â consistent with this codebase's own established pattern (Phase 0 already documented that this project deliberately threads `tenantId` explicitly through every function rather than using a magic scoping layer; this is the same discipline applied one level deeper).

```ts
// src/lib/project-access.ts â replaces the post-filter helper from Phase 1
/**
 * Returns undefined for internal roles (no restriction â merge nothing into
 * the where clause) or a project-ID array for CLIENT (merge as `projectId:
 * { in: [...] }`). Returning undefined vs. an array, rather than an
 * always-present filter, keeps this composable with each call site's own
 * where clause without every caller needing an if/else.
 */
export async function accessibleProjectIdFilter(tenantId: string, role: Role, userId: string): Promise<string[] | undefined> {
  if (role !== "CLIENT") return undefined;
  return listAccessibleProjectIdsForUser(tenantId, userId);
}
```

### 1.2 Exemplar â `tasks-module.ts`'s tenant-wide list function

```ts
// Before (Phase 4's version, correct for internal roles, wrong for CLIENT)
export async function listAllTasks(tenantId: string, { skip, take }: { skip: number; take: number }) {
  const [items, total] = await Promise.all([
    db.task.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, skip, take }),
    db.task.count({ where: { tenantId } }),
  ]);
  return { items, total, /* ... */ };
}

// After â the accessible-ID filter is part of the SAME where clause used by
// both the findMany and its paired count, so page contents and page count
// stay consistent with each other no matter which role is asking
export async function listAllTasks(
  tenantId: string,
  { skip, take }: { skip: number; take: number },
  role: Role,
  userId: string
) {
  const projectIds = await accessibleProjectIdFilter(tenantId, role, userId);
  const where: Prisma.TaskWhereInput = {
    tenantId,
    ...(projectIds ? { projectId: { in: projectIds } } : {}),
  };
  const [items, total] = await Promise.all([
    db.task.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.task.count({ where }),
  ]);
  return { items, total, page: skip / take + 1, pageSize: take, pageCount: Math.ceil(total / take) };
}
```

A `CLIENT` user now gets a correctly-paginated view of *only their accessible tasks* â real pages, real counts, no page silently coming back empty because the filter ran too late.

### 1.3 Apply the identical shape to the other two files in Â§0's table

- `contracts.ts` â add pagination (it has none yet, so this phase gives it both fixes at once rather than pagination now and scoping later) and the same `where`-embedded `projectIds` filter.
- `documents.ts` / `documents-module.ts` â audit each of the un-paginated `findMany` calls specifically for whether it's reachable by a `CLIENT` session; anywhere it is, apply both fixes together the same way. Anywhere it isn't (internal-only views), Phase 4's plain pagination fix is sufficient on its own â don't add the accessible-ID plumbing to a query a `CLIENT` can never reach.

### 1.4 What this means for anything from Phase 4 already shipped

If `tasks-module.ts`'s pagination landed exactly as Phase 4 specified before this phase started, this isn't a rollback â it's an additive fix to the same function signature (adding `role`/`userId` parameters and the `where` merge). Check whether any `CLIENT`-role account exists yet in production; if not, this has been a latent bug with no actual victim yet, which is the best-case timing to catch it.

---

## 2. Testing

This is exactly the kind of bug that's invisible against QA fixtures unless the test is specifically shaped to catch it: seed a `CLIENT` user with access to a small subset of tasks embedded among a larger tenant-wide set positioned such that naive pagination would place them past page 1 (e.g., grant access to tasks that are recent enough to sort onto page 3+ of the full tenant list). Assert that page 1 of the `CLIENT`'s view shows their actual accessible tasks, not an empty page. This test would have failed against Phase 1 + Phase 4 shipped independently and passes once this phase's fix lands â worth writing it first, watching it fail, then fixing the function, as direct proof the bug was real.

## 3. Acceptance criteria

- [ ] `scopeToAccessibleProjects()` (the post-filter version) is removed from any file that also does DB-level pagination; retained only if there's a genuinely small, unpaginated list still using it (verify none remain before deleting it entirely).
- [ ] `tasks-module.ts`, `contracts.ts`, and the `CLIENT`-reachable functions in `documents.ts`/`documents-module.ts` all merge the accessible-project-ID filter into the same `where` clause used by both `findMany` and `count`.
- [ ] The regression test in Â§2 passes.
- [ ] A `CLIENT` user's page counts and page contents are consistent with each other (no page that claims 25 total results but renders fewer, or vice versa).

## 4. Sequencing

```
tasks-module.ts   âââ do first â the one function named in both prior PRDs,
                       highest chance of being the one someone builds on
contracts.ts      âââ same shape, do second (also gets pagination for the
                       first time, not just the scoping fix)
documents.ts /
documents-module.ts â audit last â mixed file, needs the reachability check
                       from Â§1.3 before blindly applying the pattern everywhere
```

## 5. Definition of Done for Phase 6

- [ ] No list function in the codebase both paginates at the DB level and filters `CLIENT` access after the fact.
- [ ] The three files in Â§0's table are fixed and tested.
- [ ] Zero new business features shipped during this phase.

## 6. What comes next (not in scope here)

This same reconciliation check belongs in the room for every future phase that touches either access scoping or list queries â worth a one-line addition to whatever review checklist or CLAUDE.md/AGENTS.md convention doc guides future work on this codebase: *"if a list function is both role-scoped and paginated, the scoping filter must be in the `where` clause, not a post-fetch step."* That's a cheaper fix than re-discovering this same bug in a fourth file six months from now.
