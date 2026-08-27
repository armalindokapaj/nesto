# Construction OS (Nesto) â PRD: Phase 18, Missing Access Revocation v1.0

**Status:** Draft for implementation â **treat as the highest-priority finding in this entire review series**
**Owner:** Lindo (solo full-stack)
**Depends on:** none
**Scope:** one new function, one wiring change to an existing one â small in code size, large in consequence.

---

## 0. What I found â and why this one outranks everything else found so far

Every prior phase in this series found a gap in something that otherwise mostly worked. This one is different: **the feature doesn't exist at all.**

`src/lib/dal.ts`'s `getCurrentUser()` â read carefully back in Phase 9 â explicitly checks for and rejects suspended access:

```ts
if (!user || !membership || membership.accessMode === "SUSPENDED" || membership.accessMode === "ARCHIVED") {
  redirect("/api/auth/invalidate");
}
```

`src/app/actions/auth.ts`'s `login()` checks the same thing at sign-in. Both are correctly written, defensive code â for a feature that has no way to ever actually trigger. I searched the entire codebase for every place `accessMode` is written, not just read:

```
src/app/actions/users.ts:80:  accessMode: "STANDARD"   â only write, happens once, at account creation
```

That's the only write to `accessMode` anywhere in `src/`. Every other reference â `hse.ts`, `event-centre.ts`, `setup-center.ts`, `dal.ts`, `auth.ts` â only ever *reads* it, checking `!= "SUSPENDED"` or `== "SUSPENDED"` as if suspension were a real, reachable state. **It never is.** Once a `CompanyMembership` is created, nothing in this application â no admin action, no offboarding flow, no button anywhere â can ever move it to `SUSPENDED` or `ARCHIVED`. Every account, for every user, in every tenant, has permanent access from the moment it's created until someone manually edits the production database.

**This connects directly to a second gap that makes the real-world consequence concrete rather than theoretical:**

```ts
// src/server/hr.ts
export async function terminateEmployment(tenantId: string, actorId: string, employmentId: string, effectiveEndDate: Date, notes?: string) {
  const employment = await db.employmentRelationship.findUnique({ where: { id: employmentId }, include: { employee: true } });
  if (!employment || employment.tenantId !== tenantId) throw new Error("Employment relationship not found.");
  if (employment.status !== "ACTIVE") throw new Error("Only an active employment can be terminated.");

  const updated = await db.employmentRelationship.update({
    where: { id: employmentId },
    data: { status: "TERMINATED", effectiveEndDate, notes: /* ... */ },
  });
  // ...HR activity log...
  return updated;
}
```

This is HR's actual "fire someone" action, and it's careful about the parts it touches (status guard, audit trail) â it just never touches `CompanyMembership` at all. `Employee.userId` is a real, nullable, unique link to `UserIdentity` (confirmed in the schema), so the connection is there to make. Right now: **HR terminates an employee's employment record, and their login access is completely unaffected.** They can keep signing in, keep seeing payroll/finance/contracts/whatever their role permits, indefinitely, because the one mechanism that could stop them (`accessMode: "SUSPENDED"`) has never been built.

Put the two findings together and the conclusion is blunt: this application currently has no way to remove a fired employee's access to company data. That is a baseline requirement for any real business software handling payroll, HR, and financial records â the kind of control every SOC 2/ISO 27001-style audit checks for by name â and it's missing entirely, not just incomplete.

---

## 1. The fix

### 1.1 Build the missing primitive: `setMembershipAccess()`

```ts
// src/server/admin.ts (or a new src/server/membership.ts if admin.ts is
// already large enough to warrant the split â check before adding here)
export async function setMembershipAccess(
  tenantId: string,
  actorId: string,
  membershipId: string,
  accessMode: "STANDARD" | "VIEW_ONLY" | "SUSPENDED" | "ARCHIVED"
) {
  const membership = assertTenant(await db.companyMembership.findUnique({ where: { id: membershipId } }), tenantId, "CompanyMembership");
  if (membership.userId === actorId && accessMode !== "STANDARD") {
    throw new Error("You cannot suspend or archive your own access.");
  }
  const updated = await db.companyMembership.update({ where: { id: membershipId }, data: { accessMode } });
  await db.auditEvent.create({
    data: { tenantId, actorId, action: "MEMBERSHIP_ACCESS_CHANGED", targetType: "CompanyMembership", targetId: membershipId, metadata: JSON.stringify({ newAccessMode: accessMode, previousAccessMode: membership.accessMode }) },
  });
  return updated;
}
```
The self-suspension guard matters here specifically â without it, an Owner could accidentally lock themselves out with no other Owner able to undo it (depending on whether any other `OWNER`/`ADMIN` exists in the tenant).

Gate the corresponding action/UI behind `can(role, "USER_MANAGEMENT", "FULL")`, matching the existing permission matrix rather than inventing a new resource for it.

### 1.2 Wire `terminateEmployment()` to actually revoke access, not just close the HR record

```ts
export async function terminateEmployment(tenantId: string, actorId: string, employmentId: string, effectiveEndDate: Date, notes?: string) {
  const employment = await db.employmentRelationship.findUnique({
    where: { id: employmentId },
    include: { employee: { include: { user: true } } }, // pull the linked UserIdentity, if any
  });
  if (!employment || employment.tenantId !== tenantId) throw new Error("Employment relationship not found.");
  if (employment.status !== "ACTIVE") throw new Error("Only an active employment can be terminated.");

  return db.$transaction(async (tx) => {
    const updated = await tx.employmentRelationship.update({
      where: { id: employmentId },
      data: { status: "TERMINATED", effectiveEndDate, notes: /* ...unchanged... */ },
    });

    if (employment.employee.userId) {
      // The employee has a real login â suspend it in the same transaction
      // as the termination, not as a separate step someone has to
      // remember. This is the actual fix: HR terminating someone now
      // means their access is gone the instant this commits, not
      // whenever (if ever) someone separately visits a user-management screen.
      await tx.companyMembership.updateMany({
        where: { tenantId, userId: employment.employee.userId },
        data: { accessMode: "SUSPENDED" },
      });
    }

    await tx.hrActivity.create({
      data: { tenantId, entityType: "EmploymentRelationship", entityId: employmentId, actorId, eventType: "TERMINATED", summary: `${employment.employee.fullName} â employment terminated` },
    });
    return updated;
  });
}
```

### 1.3 One decision worth making explicitly: what about the other end â reactivation

A `RESIGNED`-then-`REHIRED` employee, or a mistaken termination, needs a way back to `STANDARD` access. `setMembershipAccess()` from Â§1.1 already supports this generically (any admin can flip access back) â no separate "unterminate" flow is needed as long as that admin UI exists and an HR/Admin knows to use it. Don't build a bespoke reactivation flow tied specifically to `terminateEmployment()`'s reversal; the general-purpose access toggle is the right level of tooling here, consistent with keeping this fix small rather than building a parallel state machine for the membership side to mirror the employment side.

### 1.4 Acceptance criteria
- [ ] `setMembershipAccess()` exists, is gated by `USER_MANAGEMENT: FULL`, blocks self-suspension, and writes an audit event.
- [ ] `terminateEmployment()` suspends the linked `CompanyMembership` in the same transaction, when one exists.
- [ ] A test proves the exact real-world scenario this phase fixes: terminate an employee with a linked user account, then attempt to log in as that user (or call `getCurrentUser()` directly) and confirm access is denied â not just that the database row changed, but that the actual login path rejects it.
- [ ] A terminated employee with no linked `UserIdentity` (a field worker who never had a login) is handled gracefully â no error, nothing to suspend.
- [ ] An admin UI surface exists for `setMembershipAccess()` â this fix is worthless if the only way to call it is directly in code; check whether `dashboard/admin` already has a user-management screen this slots into, or whether one needs to be added.

---

## 2. Sequencing

```
setMembershipAccess() + admin UI wiring  âââ do first â this is the
                                               general-purpose primitive,
                                               and useful on its own even
                                               before HR integration lands
terminateEmployment() integration         âââ second, depends on the above
                                               existing to call into
```

## 3. Definition of Done for Phase 18

- [ ] A working, admin-accessible way to suspend and reactivate any user's access exists for the first time in this application.
- [ ] Terminating an employee's employment automatically revokes their login access when one exists, in the same transaction as the termination itself.
- [ ] The end-to-end test (terminate â attempt login â denied) passes.
- [ ] Zero new business features shipped during this phase â this is closing a gap in an existing, already-designed-for mechanism (`accessMode`'s values and every read-site already assumed this would exist), not adding new scope.

## 4. What comes next (not in scope here)

A scheduled or on-demand audit report ("which active memberships have no corresponding active `EmploymentRelationship`") to catch the case where this fix ships going forward but doesn't retroactively catch anyone already terminated before it existed â worth running once, manually, right after this phase deploys, to check whether any currently-terminated employees in production already have live, unsuspended access from before this fix existed. And, smaller: while reading `Employee`'s schema for this phase, its `photoDataUrl` field comment states *"this app has no object storage anywhere"* â a claim that directly contradicts `schema.prisma`'s own header comment about a Neon/Blob deployment that Phase 0 flagged as unverified. This is now the third piece of evidence pointing the same direction; worth resolving Phase 0's original "what's actually deployed" question before much more work assumes one state or the other.
