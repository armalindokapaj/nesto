# Construction OS (Nesto) â PRD: Phase 1, Access Control & Audit Coverage v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 0 (Postgres live, files out of the DB, CI running) â this phase assumes that foundation is in place, since every change here should be caught by the test suite before it ships.
**Scope:** no new business modules; this phase makes existing infrastructure actually enforce what it already claims to.

---

## 0. What I found, and why this is the right next phase

This phase is not speculative. I traced the actual call sites of every access-control primitive already in the codebase, and found something specific and fixable: **the infrastructure for record-level access mostly already exists â it's just not wired up everywhere it needs to be.** That's a better place to be than "needs to be built from scratch," and it changes the shape of this phase from a new subsystem to a wiring and instrumentation pass.

| # | Finding | Evidence |
|---|---|---|
| A | **External clients can see every project in the tenant, not just their own â contradicting the system's own documented design.** `src/lib/permissions.ts` grants `CLIENT` role `PROJECTS: "READ"`, `TASKS: "READ"`, `CONTRACTS: "READ"`, `DOCUMENTS: "READ"` at the coarse, tenant-wide level. `listProjectsWithRelationship(tenantId, userId)` in `src/server/projects.ts` returns every project in the tenant with no relationship filter â the code comment even says *"PRD_10 Â§5.1 â every project is discoverable company-wide,"* which is a deliberate choice for internal roles (PM, Architect, Sales, etc.) but is never distinguished from external roles. Meanwhile, `src/server/portal-access.ts` already has a fully-built `listAccessibleProjectIdsForUser()` function backed by `ExternalOrganization` / `BusinessAccessRelationship` â the schema comment above `ExternalOrganization` states explicitly that this exists so external CLIENT/CONTRACTOR logins see *only projects explicitly granted to their organization*. That function is called **nowhere except its own file.** The door was built; nothing latches it. |
| B | **`CONTRACTOR` is correctly scoped â this is the pattern to copy, not a second problem.** `getContractorWorkPackages()` in `src/server/task-orchestration.ts` correctly returns only a contractor's own `TaskContractorAssignment` rows, and the permission matrix backs it up (`CONTRACTOR: { PROJECTS: "NONE", TASKS: "NONE", ... }` â access flows entirely through the scoped function, not the coarse gate). This proves the codebase already knows how to do this correctly for one role; Track A is about extending the same approach to `CLIENT`. |
| C | **Audit logging covers roughly 10% of write paths.** `AuditEvent` rows are written from only 9 files (`admin.ts`, `finance.ts` action, `users.ts` action, `contract-lifecycle*.ts`, `document-lifecycle-reactions.ts`, `event-centre.ts`, `workflow-engine.ts`). Payroll (`payroll.ts`, `hr-timesheets.ts`), HR (`hr.ts`, `employee-profile.ts`), procurement (`procurement.ts`, 31KB, `procurement-comparison.ts`), legal (`legal.ts`), QA/QC (`qaqc.ts`), and most of finance (`finance-module.ts`, `finance-spendings.ts`, `finance-budget.ts`) write **zero** audit events despite `AUDIT_LOGS` being a first-class permission resource that implies these trails exist. |
| D | **One capability is defined but never checked.** `src/lib/capabilities.ts` defines `hr.compensation.view` as a sensitive, per-user-revocable capability, and `src/server/capabilities.ts`'s `hasCapability()` is correctly implemented. But `hasCapability()` is only actually called from `hse.ts`, `workflow-engine.ts`, and `event-centre.ts` â never from anywhere that reads salary/compensation data (`hr.ts`, `employee-profile.ts`, `payroll.ts`). The other three capability keys are properly enforced; this one isn't. |
| E | **The domain-event outbox has exactly one real workflow wired to it, and no visibility into failures.** `DomainEvent` is a well-designed transactional outbox (correlation/causation IDs, actor snapshot, confidentiality field) but is only used by the ContractâFinance reference workflow (4 files total). Its own schema comment says a `PENDING`/`FAILED` row is "exactly what a future background worker would sweep and retry" â that worker doesn't exist, so a failed event today is invisible until someone queries the table by hand. |

Findings A and C are the ones with real stakes: A is an active data-exposure gap the moment a real external client account exists, and C means most of the system currently has no forensic trail for disputes, payroll errors, or compliance questions.

---

## 1. Track A â Close the external-user project scoping gap

### 1.1 Target state

- `CLIENT` role behaves the way `CONTRACTOR` already correctly does: access flows through an explicit scoping function, not the coarse `can()` gate plus an unfiltered `findMany`.
- `listAccessibleProjectIdsForUser()` (already written, already correct) becomes the single source of truth for "which projects can this external user see," called from every read path that currently calls the unscoped project/task/document/contract queries when the viewer's role is `CLIENT`.
- No schema changes. This is entirely a wiring change in the server and page layer.

### 1.2 Concrete changes

**`src/server/projects.ts`**
```ts
// Before
export async function listProjectsWithRelationship(tenantId: string, userId: string) { ... }

// After â same signature, role-aware inside
export async function listProjectsWithRelationship(tenantId: string, userId: string, role: Role) {
  const where: Prisma.ProjectWhereInput = { tenantId };
  if (role === "CLIENT") {
    const accessibleIds = await listAccessibleProjectIdsForUser(tenantId, userId);
    where.id = { in: accessibleIds };
  }
  // ...existing query, now using `where`
}
```
Same pattern for `listProjects()` and `getProject()` â `getProject` additionally needs to `assertTenant`-style throw (or 404) if a CLIENT requests a project ID outside their accessible set, not just filter it out of a list.

**Call sites to update** (found via `grep -rn "listProjectsWithRelationship\|listProjects\b\|getProject\b" src/app`):
- `src/app/(workspace)/projects/page.tsx` â pass `role` through, already has it from `getCurrentUser()`.
- `src/app/(workspace)/projects/[id]/page.tsx` â same; also the highest-priority one, since this is where a leaked project's task list, documents, and (if `canViewProjectFinance` is mis-set for CLIENT â verify it returns `false`) budget would actually render.
- Anywhere else these functions are imported (`nav-config.ts` references `canViewTask` already, confirm it doesn't independently re-fetch projects without the new filter).

**Tasks, documents, contracts:** the same shape of gap exists for any list/read function these pages call when `role === "CLIENT"`. Audit `src/server/tasks-module.ts`, `src/server/documents-module.ts` / `documents.ts`, and `src/server/contracts.ts` / `contracts-module.ts` the same way â each needs either its own accessible-ID filter or (simpler, and preferred per "don't overengineer") a single shared helper:

```ts
// src/lib/project-access.ts â add alongside the existing task-visibility helpers
export async function scopeToAccessibleProjects<T extends { projectId: string | null }>(
  tenantId: string,
  role: Role,
  userId: string,
  rows: T[]
): Promise<T[]> {
  if (role !== "CLIENT") return rows;
  const accessibleIds = new Set(await listAccessibleProjectIdsForUser(tenantId, userId));
  return rows.filter((r) => r.projectId !== null && accessibleIds.has(r.projectId));
}
```
This is a post-filter, not a query-level `WHERE` â deliberately simple to add across many call sites without touching each one's Prisma query shape. It's not the most efficient version (a proper fix pushes the filter into the query), but it's the version that ships this phase without rewriting five modules' query logic. Flag any list that's large enough for this to matter (paginated documents lists, for instance) for a follow-up query-level optimization â don't block this phase on it.

**`VIEWER` role:** same gap, same fix â `VIEWER` has identical `READ`-everywhere grants to `CLIENT` in the permission matrix with no evidence of what a "Viewer" actually is in the PRDs. Decide explicitly: is `VIEWER` meant to be internal (an auditor/investor with company-wide read) or another external role? If internal, leave it unscoped like other employee roles. If external, apply the same fix as CLIENT. Don't leave it ambiguous â this is the kind of role that's easy to forget in future access reviews if its intent isn't written down now.

### 1.3 Testing

Extend `tests/unit/tenant.test.ts` (or add `tests/unit/project-access.test.ts`) with the case Phase 0's CI now makes cheap to run on every PR: a `CLIENT` user with an access grant to Project A only must not see Project B in any of `listProjectsWithRelationship`, `getProject`, task lists, document lists, or contract lists â assert an empty/404 result for B, not just a shorter list.

### 1.4 Acceptance criteria
- [ ] A `CLIENT`-role user with a `BusinessAccessRelationship` grant to Project A cannot retrieve Project B (or its tasks/documents/contracts) through any code path, verified by a new test.
- [ ] `VIEWER` role's intended scope (internal vs. external) is decided and documented in `src/lib/constants.ts` next to the role definition; scoping applied if external.
- [ ] `CONTRACTOR`'s existing correct pattern is unchanged â this track adds scoping, it doesn't touch what already works.

---

## 2. Track B â Audit log coverage for sensitive writes

### 2.1 Target state

Every write to payroll, compensation, procurement approvals, legal records, and QA/QC sign-offs produces an `AuditEvent` row, using one shared helper instead of the ad hoc `db.auditEvent.create()` calls the 9 existing writers each do independently.

### 2.2 The helper (new, small, and the only new abstraction this phase introduces)

```ts
// src/lib/audit.ts
import "server-only";
import { db } from "@/lib/db";

export async function logAudit(params: {
  tenantId: string;
  actorId: string | null;
  action: string;        // e.g. "payroll.run.finalized", "hr.compensation.updated"
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
}
```
Existing writers keep working unchanged (this doesn't replace `AuditEvent`, just gives new callers one line instead of a repeated `db.auditEvent.create({...})` block). Adopt the helper going forward; backfilling the 9 existing call sites to use it is a nice-to-have cleanup, not required for this phase.

### 2.3 Where to add calls â the concrete gap list

| File | Sensitive writes with no audit trail today |
|---|---|
| `src/server/payroll.ts` | Payroll run creation/finalization, adjustment entries |
| `src/server/hr.ts`, `src/server/employee-profile.ts` | Compensation/salary changes, role/employment status changes |
| `src/server/hr-timesheets.ts` | Timesheet approval/rejection (payroll-adjacent) |
| `src/server/procurement.ts`, `procurement-comparison.ts` | PO approval, vendor comparison decision, award |
| `src/server/legal.ts` | Case status changes, legal opinion records |
| `src/server/qaqc.ts` | Inspection sign-off, non-conformance closure |
| `src/server/finance-module.ts`, `finance-spendings.ts`, `finance-budget.ts` | Budget revision, spending approval â currently only `src/app/actions/finance.ts` writes audit events, and only for whatever that one action file covers |
| `src/server/contracts-module.ts` | Contract state transitions outside the one reference workflow already covered by `contract-lifecycle.ts` |

Pick the single mutating function in each file that represents the "approval" or "finalization" moment (not every read or minor edit) and add one `logAudit()` call there. This phase is about closing the biggest gaps, not instrumenting every field change â that's proportionate, not exhaustive.

### 2.4 Acceptance criteria
- [ ] `src/lib/audit.ts` helper exists and is used by every file in the table above, at minimum at the approval/finalization step.
- [ ] A query against `AuditEvent` for a given `tenantId` shows entries for payroll runs, compensation changes, procurement awards, legal case changes, and QA/QC sign-offs â verify this manually against seeded QA fixtures, not just by reading the code.
- [ ] No change to `AuditEvent`'s schema â this track is pure instrumentation.

---

## 3. Track C â Enforce the compensation capability

### 3.1 Target state

`hr.compensation.view` behaves like the other three capability keys: actually gates something.

### 3.2 Concrete change

Find every place `hr.ts` / `employee-profile.ts` / `payroll.ts` returns a salary, rate, or compensation figure to a page or action. Wrap the read (or the specific fields in the response) with:

```ts
import { hasCapability } from "@/server/capabilities";

const canSeeComp = await hasCapability(tenantId, viewerId, viewerRole, "hr.compensation.view");
// either omit the field entirely, or return a masked value ("Restricted")
// consistent with how canViewProjectFinance already handles the same
// pattern for project budgets â reuse that convention, don't invent a new one.
```

The `FINANCE` resource's coarse gate already gets a role this far in most cases (per the permission matrix, `HR`/`FINANCE`/`OWNER`/`ADMIN` have `hr.compensation.view` by default) â this track is specifically about the case the capability exists *for*: letting an Owner grant or revoke it for one named person without changing their role (e.g., a PM who needs to see one project's labor cost rollup but not the underlying salaries).

### 3.3 Acceptance criteria
- [ ] Every compensation figure surfaced anywhere in HR/employee-profile/payroll pages is gated by `hasCapability(..., "hr.compensation.view")`, not just by the coarse `HR`/`FINANCE` resource check.
- [ ] Revoking the capability for a specific HR-role user (via the existing `revokeCapability()`) actually hides compensation data for that user on next request â verify with a test, since `hasCapability`'s deny-override logic is already correct and just needs a real caller to prove it.

---

## 4. Track D â Make domain-event failures visible (not a job queue)

### 4.1 What this is and isn't

This is **not** "build a background job system" â that's explicitly deferred, and adding one now would be exactly the overengineering this project should avoid at this stage. It's two small things:

1. A place to see `DomainEvent` rows stuck in `PENDING` or `FAILED` status, since right now that requires a manual DB query.
2. A manual "retry" action an Owner/Admin can click, since automatic retry is a job-queue problem and manual retry is a button.

### 4.2 Concrete change

- Add a simple admin page (`src/app/(workspace)/dashboard/admin/domain-events/page.tsx`, alongside the existing `admin/portal-access` page for consistency) listing `DomainEvent` rows where `status IN ('PENDING', 'FAILED')`, showing `type`, `error`, `createdAt`, `correlationId`.
- One server action, `retryDomainEvent(tenantId, eventId)`, that re-runs whatever `contract-lifecycle-reactions.ts` already does for a fresh event of that type, and updates `status`/`processedAt` on success.
- If and when there's a second workflow that needs the outbox pattern (this phase doesn't require generalizing it further â wait for a second real use case before abstracting), revisit whether a scheduled sweep (Vercel Cron is one config file, not a new service) is worth adding. Not now.

### 4.3 Acceptance criteria
- [ ] An Owner/Admin can see every `PENDING`/`FAILED` domain event in one place without querying the database directly.
- [ ] A failed event can be manually retried from the UI.
- [ ] No new background worker, queue, or scheduled job introduced in this phase.

---

## 5. Sequencing

```
Track B (audit helper + coverage) âââ independent, do first (cheapest, no risk,
                                        and the helper is reused by nothing else
                                        in this phase, so it can't block anything)
Track A (project scoping)          âââ highest priority by risk; do second
Track C (compensation capability)  âââ independent of A/B, do third
Track D (domain-event visibility)  âââ lowest urgency, do last
```

Recommended order: **B â A â C â D.** Audit logging is zero-risk and immediately useful even before Track A ships. Track A is the one with real exposure, so it follows immediately. C and D are cleanups that don't block anything else.

---

## 6. Definition of Done for Phase 1

- [ ] `CLIENT` (and `VIEWER`, if decided to be external) role is provably scoped to only its granted projects across projects, tasks, documents, and contracts â with a test proving cross-project access is denied, not just filtered from a list.
- [ ] Payroll, HR compensation, procurement, legal, and QA/QC approval actions all write `AuditEvent` rows via the shared `logAudit()` helper.
- [ ] `hr.compensation.view` capability actually gates compensation data somewhere real, with a test proving revocation works.
- [ ] Stuck domain events are visible and manually retryable from an admin page.
- [ ] Zero new business features shipped during this phase â same rule as Phase 0.

## 7. What comes next (not in scope here)

Query-level (not post-filter) optimization for the Track A scoping helper once list sizes justify it; generalizing the domain-event outbox to a second workflow if one emerges; real notification delivery (email/SMS) for the events this phase makes visible in-app; and background jobs, once there's more than one thing that actually needs scheduling.
