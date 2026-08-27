# Construction OS (Nesto) â PRD: Phase 12, Approval Guard Sweep v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** none â same bug family as Phase 11, this time swept across the whole codebase instead of one file
**Scope:** four functions across four files â no new business modules.

---

## 0. What I found

Phase 11 closed one instance of "this decision can be silently overwritten after the fact" and flagged, explicitly, that it was found by comparing one function to its closest siblings â not by a systematic sweep. This phase is that sweep: every function in `src/server/` whose name matches approve/reject/decide/release/sign, checked for the same guard.

The result is reassuring in the same way Phase 10 and 11 were â most of these are done correctly, which makes the exceptions easy to name precisely:

| Function | File | Guard against re-deciding | Verdict |
|---|---|---|---|
| `decide()` | `workflow-engine.ts` | `status !== "ACTIVE"` | Correct (Phase 11 reference) |
| `decideAward()` | `procurement-comparison.ts` | `status !== "SUBMITTED"` | Correct (Phase 11 reference) |
| `approveContract()` | `contract-lifecycle.ts` | `assertTransition()` state machine | Correct (Phase 11 reference) |
| `decideSpendingBill()` | `finance-spendings.ts` | Delegates to `decide()` | Correct â inherits the guard for free |
| `releaseStopWorkOrder()` | `hse.ts` | `status !== "ACTIVE"` | Correct |
| `approveCount()` | `inventory-dashboard.ts` | `status !== "SUBMITTED"` | Correct |
| `cancelApprovedLeave()` | `hr.ts` | `status !== "APPROVED"` | Correct |
| **`decideLeaveRequest()`** | **`hr.ts`** | **None** | **Gap â and the fix pattern is nine lines below it in the same file** |
| **`decideSubmittal()`** | **`architecture.ts`** | **None** | **Gap** |
| **`approveRiskAssessment()`** | **`hse.ts`** | **None** | **Gap (lower severity â see Â§1.3)** |
| **`decideDocumentApproval()`** | **`documents.ts`** | **Partial** â blocks `SUPERSEDED` only, not `APPROVED`/`REJECTED` | **Narrower gap â see Â§1.4** |

The `decideLeaveRequest()` finding is the sharpest of the four, because the correct guard exists nine lines further down the exact same file:

```ts
// src/server/hr.ts
export async function decideLeaveRequest(tenantId: string, decidedById: string, leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  return db.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: decision, decidedById } }); // <- no status check
}

// PRD_9 LEV-003 â "only HR shall be able to change or cancel an approved
// leave entry"; both functions require the entry to already be APPROVED.
export async function cancelApprovedLeave(tenantId: string, decidedById: string, leaveRequestId: string) {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  if (leave.status !== "APPROVED") throw new Error("Only an approved leave entry can be cancelled."); // <- correct, right here
```
The comment even says *"both functions require the entry to already be APPROVED"* â but only one of the two actually enforces anything. An already-`APPROVED` leave request (which, per that same comment, has payroll/attendance implications once approved) can be silently flipped to `REJECTED` with a second call, or an already-`REJECTED` one flipped to `APPROVED`.

---

## 1. The fix

### 1.1 `decideLeaveRequest()` â highest priority, matches `cancelApprovedLeave()`'s own established pattern

```ts
export async function decideLeaveRequest(tenantId: string, decidedById: string, leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  if (leave.status !== "PENDING") {
    throw new Error(`This leave request has already been decided (status: ${leave.status}).`);
  }
  return db.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: decision, decidedById } });
}
```
Confirm `LeaveRequest.status` actually defaults to `"PENDING"` in the schema before shipping â same verification step as Phase 11.

### 1.2 `decideSubmittal()` â second priority, real construction governance stakes

```ts
// Submittal.status is OPEN | IN_REVIEW | APPROVED | REJECTED | RETURNED
// (confirmed against prisma/schema.prisma â RETURNED is a legitimate
// resubmission state, not a terminal one, so it must stay decidable;
// only APPROVED/REJECTED are actually final).
export async function decideSubmittal(tenantId: string, actorId: string, input: { id: string; decision: "APPROVED" | "REJECTED" | "RETURNED"; comment?: string }) {
  const submittal = assertTenant(await db.submittal.findUnique({ where: { id: input.id } }), tenantId, "Submittal");
  if (submittal.status === "APPROVED" || submittal.status === "REJECTED") {
    throw new Error(`This submittal has already been decided (status: ${submittal.status}).`);
  }
  return db.submittal.update({
    where: { id: input.id },
    data: { status: input.decision, reviewerId: actorId, decidedAt: new Date(), comment: input.comment },
  });
}
```
Blocking on the terminal states specifically (rather than allow-listing the in-flight ones) is the safer shape here â it degrades correctly if a new in-flight status is ever added to the enum later, where an allow-list would silently block a legitimate state nobody remembered to add.

### 1.3 `approveRiskAssessment()` â lower severity, still worth closing for consistency

This one is a narrower case: there's no corresponding `rejectRiskAssessment()` in the codebase, so the realistic bad outcome is smaller â mostly redundant re-approval (harmless except for a duplicate `logHseActivity` entry) rather than a flip between two opposite outcomes. Still worth the same one-line guard, both for consistency with every other function in this table and because a `RiskAssessment` feeds the HSE module's "work-start safety gate" heuristic (per the comment in `hse.ts` itself) â an assessment that's already approved silently getting a fresh `approvedById` on a second call is a smaller version of the same "who actually approved this, and when" integrity question the other three fixes address.

```ts
export async function approveRiskAssessment(tenantId: string, approvedById: string, riskAssessmentId: string) {
  const ra = assertTenant(await db.riskAssessment.findUnique({ where: { id: riskAssessmentId } }), tenantId, "RiskAssessment");
  if (ra.status === "APPROVED") throw new Error("This risk assessment is already approved.");
  return db.$transaction(async (tx) => {
    const updated = await tx.riskAssessment.update({ where: { id: ra.id }, data: { status: "APPROVED", approvedById } });
    await logHseActivity(tenantId, "RiskAssessment", ra.id, approvedById, "APPROVED", "Risk assessment approved", tx);
    return updated;
  });
}
```

### 1.4 `decideDocumentApproval()` â narrow the existing partial guard into a full one

This function already blocks the `SUPERSEDED` case and already writes a full `DocumentApproval` history row per decision (better audit trail than any of the other three) â it just doesn't also block deciding on a document that's already `APPROVED` or `REJECTED`:

```ts
// Add alongside the existing SUPERSEDED check
if (doc.status === "APPROVED" || doc.status === "REJECTED") {
  throw new Error(`This document has already been decided (status: ${doc.status}).`);
}
```
Verify this doesn't break a legitimate resubmission-after-`REQUEST_CHANGES` flow â `CHANGES_REQUESTED` should remain decidable (that's the whole point of that status), only the two terminal outcomes need blocking.

---

## 2. Testing

One test per function, same shape each time: decide once (success), decide again (rejected with a clear error naming the current status). This is now the fourth time this exact test shape has appeared across Phases 10â12 â worth writing a small shared test helper (`expectAlreadyDecided(fn, ...)` or similar) rather than four independent copy-pasted tests, since the pattern itself has now proven common enough to deserve one.

## 3. Acceptance criteria

- [ ] All four functions reject a second decision on an already-finalized record, with the current status named in the error.
- [ ] `decideDocumentApproval()`'s `CHANGES_REQUESTED` â subsequent decision path still works (verify explicitly â this is the one case in the table where "already decided once" should NOT block a second decision).
- [ ] `LeaveRequest` (`PENDING | APPROVED | REJECTED | CANCELLED`) and `Submittal` (`OPEN | IN_REVIEW | APPROVED | REJECTED | RETURNED`) guards match these confirmed schema values, not a guess.

## 4. Sequencing

```
decideLeaveRequest()          âââ do first â highest real-world stakes,
                                    and the fix pattern is proven working
                                    nine lines away in the same file
decideSubmittal()              âââ second â construction-governance stakes,
                                    needs a schema check first (Â§1.2)
approveRiskAssessment()        âââ third â lower severity, quick to add
decideDocumentApproval()       âââ last â narrowing an existing partial
                                    guard, lowest risk of the four
```

## 5. Definition of Done for Phase 12

- [ ] All four functions in Â§0's table are fixed and tested.
- [ ] The eight functions confirmed already-correct in Â§0 are left untouched.
- [ ] Zero new business features shipped during this phase.

## 6. What comes next (not in scope here)

This sweep covered every function matching approve/reject/decide/release/sign in `src/server/` â a reasonably complete pass for this specific bug shape, but not a guarantee against a fifth or sixth instance under a differently-named function (`finalize`, `confirm`, `close`, `complete` are all plausible synonyms this search wouldn't catch). If this pattern surfaces a third time in a future phase under one of those verbs, it's worth converting this from "the same manual check three times" into something structural â e.g., a small `assertStatusIn(record, allowedStatuses, entityName)` helper used consistently by every status-transitioning function going forward, the same way `tenant.ts`'s `assertTenant()` became the standard shape for tenant checks after showing up enough times to be worth naming.
