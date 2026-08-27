# Construction OS (Nesto) â PRD: Phase 10, Duplicate Payroll Run Protection v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** none â independent of the access-control thread (Phases 1/6/7/8/9), a fresh area
**Scope:** one schema constraint, one function â no new business modules.

---

## 0. What I found

Stepping away from access control this time and looking at financial data-integrity instead â specifically, what stops two people (or one impatient double-click) from creating the same financial record twice.

The codebase's own track record on this is actually good, which is what makes the one gap worth calling out specifically rather than assuming the whole area needs work:

- `FiscalPeriod` has `@@unique([tenantId, name])` â you cannot create two periods both named `"2026-08"` for the same tenant. Correct, deliberate protection.
- `allocateNumber()` in `number-series.ts` generates invoice/contract/document numbers via a single atomic upsert-and-increment â the code comment is explicit that this exists so *"concurrent requests never receive the same human-readable number."* Also correct, also deliberate.
- `postInvoiceAction()` checks `invoice.status === "POSTED"` and treats a repeat request as a no-op rather than a double-post. Same instinct, applied at the action level instead of the schema level, still correct.

**`PayrollRun` has none of this.** No unique constraint in the schema, and `createPayrollRun()` in `src/server/payroll.ts` does exactly one thing â insert a row â with no check for whether a run already exists for that group and period:

```ts
export async function createPayrollRun(
  tenantId: string,
  createdById: string,
  input: { payrollGroupId: string; periodStart: Date; periodEnd: Date; payDate: Date }
) {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({ data: { tenantId, createdById, ...input } });
    // ...
    return run;
  });
}
```

A double-click on "Create payroll run," or two people independently starting the same month's run because neither saw the other had already started it, creates two `DRAFT` `PayrollRun` rows covering the identical period. If both get calculated and locked â which nothing stops, since `calculatePayrollRun()` and `lockPayrollRun()` only check the *individual* run's own status, never whether a sibling run for the same period exists â the result is two sets of `PayrollRunLine` rows, potentially both flowing into whatever pays people. This is the one financial write path in the whole review series so far where the "obviously bad if it happens twice" outcome is duplicate pay, not just a display glitch or a permission leak.

---

## 1. The fix

### 1.1 Application-level check, not a schema constraint â and here's why, explicitly

A DB-level `@@unique([tenantId, payrollGroupId, periodStart, periodEnd])` looks like the obvious fix by analogy to `FiscalPeriod`, but it has a real problem here that `FiscalPeriod` doesn't: a `PayrollRun` can legitimately be `CANCELLED` and then re-created for the same period (the existing `cancelPayrollRun()` function implies exactly this workflow). A plain unique constraint would permanently block re-creating a period's run after cancelling the first attempt â Postgres does support a *partial* unique index (`WHERE status != 'CANCELLED'`) to handle that, but Prisma's schema DSL doesn't express partial indexes directly; it'd need a raw SQL migration step bolted on after `prisma migrate dev`, maintained by hand outside the normal migration flow. That's real added complexity for a check that a plain application-level query handles just as correctly, given payroll run creation is a deliberate, low-frequency admin action, not a hot path with heavy concurrency â the realistic threat here is a double-click or two admins overlapping, not a genuine race condition needing database-level locking. Match the fix to the actual risk:

```ts
// src/server/payroll.ts
export async function createPayrollRun(
  tenantId: string,
  createdById: string,
  input: { payrollGroupId: string; periodStart: Date; periodEnd: Date; payDate: Date }
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.payrollRun.findFirst({
      where: {
        tenantId,
        payrollGroupId: input.payrollGroupId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: { not: "CANCELLED" },
      },
    });
    if (existing) {
      throw new Error(`A payroll run for this period already exists (status: ${existing.status}).`);
    }
    const run = await tx.payrollRun.create({ data: { tenantId, createdById, ...input } });
    await logPayrollActivity(tenantId, "PayrollRun", run.id, createdById, "CREATED", "Payroll run created (draft)", tx);
    return run;
  });
}
```
Running the check and the create inside the same `$transaction` closes the realistic version of this race (two requests hitting the check within milliseconds of each other under Postgres's default transaction isolation still won't produce two committed rows for the exact same period, since the second transaction's `create` commits after the first's check has already seen the row) â it's not airtight against every theoretical concurrency scenario the way a DB constraint would be, but it's proportionate to a feature nobody is hammering with concurrent requests in practice, and it's a one-function change instead of a hand-maintained migration exception.

### 1.2 Surface the error usefully, not just correctly

Whatever action calls `createPayrollRun()` should show the specific existing run's status back to the user ("A payroll run for August 2026 already exists â status: CALCULATED") rather than a generic failure, since the realistic cause is almost always "someone already did this," and telling the user that directly saves them from re-checking themselves.

### 1.3 Acceptance criteria
- [ ] Attempting to create a second non-cancelled `PayrollRun` for the same `tenantId` + `payrollGroupId` + period is rejected with a clear, specific error.
- [ ] Creating a run for a period whose only prior run was `CANCELLED` succeeds â the legitimate re-do path is not blocked.
- [ ] A test covering both cases (duplicate rejected, cancelled-then-recreated allowed) â this is exactly the kind of check that's easy to write once and easy to silently regress later if someone "simplifies" `createPayrollRun()` without knowing why the check is there.

---

## 2. While in this file: one related check worth doing, not fixing blind

`calculatePayrollRun()` and `lockPayrollRun()` each check their *own* run's status (not locked, not cancelled) but never check whether a sibling run for the same period was separately calculated or locked. If Track 1's create-time check ships, this mostly can't happen going forward â but it's worth a one-time query against production data (once this is deployed) to confirm no duplicate period already exists from before the fix, rather than assuming the fix alone cleans up any pre-existing mess.

## 3. Sequencing

Single function, single file â no multi-track breakdown needed this time. Ship the check, the improved error message, and the test together.

## 4. Definition of Done for Phase 10

- [ ] `createPayrollRun()` rejects duplicate non-cancelled runs for the same period, with a specific, useful error message.
- [ ] The cancel-then-recreate workflow is confirmed still functional.
- [ ] A one-time production data check (post-deploy) confirms no duplicate periods already exist from before this fix.
- [ ] Zero new business features shipped during this phase.

## 5. What comes next (not in scope here)

`Invoice.number` has no `@unique` constraint in the schema either â lower priority than `PayrollRun`, since `allocateNumber()`'s atomic upsert already prevents collisions for anything that goes through it, and the constraint would only add defense-in-depth against a future code path that creates an invoice without using the generator. Worth a `@@unique([tenantId, number])` addition at some point as cheap insurance, but not urgent enough to hold this phase for. Beyond that, the general question this phase raises â "which other period-based or otherwise-should-be-singular records lack the protection `FiscalPeriod` and the number-series already model correctly" â is worth a deliberate audit pass rather than fixing one instance and assuming it's the only one; `PayrollRun` was found by starting from "what's the worst financial outcome of a double-click," not from a systematic sweep, so there may be siblings.
