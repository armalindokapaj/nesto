# Construction OS (Nesto) â PRD: Phase 11, Project Approval Re-Decision Guard v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** none â independent, small, isolated
**Scope:** one function, `decideProjectApproval()` in `src/server/project-approvals.ts` â no new business modules.

---

## 0. What I found

Continuing the theme from Phase 10 â what stops an already-final decision from being changed after the fact â I checked every approval-style "decide" function in the codebase against each other, since Phase 10 found the codebase is usually careful about this. It is, in three out of four places I checked:

| Function | Guard against re-deciding | Separation of duties | Audit trail |
|---|---|---|---|
| `workflow-engine.ts` â `decide()` | `if (stage.status !== "ACTIVE") throw ...` | Yes â submitter can't decide their own workflow | Full `WorkflowDecision` history row per decision, not just an overwritten field |
| `procurement-comparison.ts` â `decideAward()` | `if (award.status !== "SUBMITTED") throw ...` | Yes â preparer can't decide their own award recommendation | `logProcurementActivity()` call |
| `contract-lifecycle.ts` â `approveContract()` | `assertTransition(contract.status, "ACTIVE")` â a real state-machine guard | N/A (single-step approval) | `AuditEvent` + a domain event |
| **`project-approvals.ts` â `decideProjectApproval()`** | **None** | **None** | **None** |

```ts
// src/server/project-approvals.ts â current
export async function decideProjectApproval(
  tenantId: string,
  approvalId: string,
  decidedById: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string
) {
  const approval = assertTenant(await db.projectApproval.findUnique({ where: { id: approvalId } }), tenantId, "ProjectApproval");
  if (approval.approverId !== decidedById) {
    throw new Error("Only the assigned approver can decide this request.");
  }
  return db.projectApproval.update({
    where: { id: approval.id },
    data: { status: decision, decidedAt: new Date(), decisionNote },
  });
}
```

This checks *who* can decide, but never *whether it's already been decided*. An already-`APPROVED` (or `REJECTED`) `ProjectApproval` can be decided again â a second call with the opposite `decision` silently overwrites `status`, `decidedAt`, and `decisionNote`, with no record that a different decision was ever made. `ProjectApproval` also wasn't in Phase 1's list of files writing `AuditEvent` rows, so this overwrite leaves no trail anywhere, unlike every one of its three siblings above.

`ProjectApproval` covers cost/timeline/technical-impact change requests on a project (per the fields in `createProjectApproval` â `costImpact`, `timelineImpact`, `technicalImpact`) â a governance-relevant decision, not a cosmetic one, and the one place in this specific family that got the guard missed.

---

## 1. The fix â bring it in line with its own siblings, not a new pattern

```ts
// src/server/project-approvals.ts
export async function decideProjectApproval(
  tenantId: string,
  approvalId: string,
  decidedById: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string
) {
  const approval = assertTenant(await db.projectApproval.findUnique({ where: { id: approvalId } }), tenantId, "ProjectApproval");

  if (approval.status !== "PENDING") {
    throw new Error(`This request has already been decided (status: ${approval.status}).`);
  }
  if (approval.approverId !== decidedById) {
    throw new Error("Only the assigned approver can decide this request.");
  }
  if (approval.requesterId === decidedById) {
    // Mirrors decideAward()'s and workflow-engine's separation-of-duties
    // check â belt-and-suspenders alongside the approverId check above,
    // since nothing at creation time (createProjectApproval) currently
    // stops requesterId and approverId from being set to the same person.
    throw new Error("You cannot decide a request you submitted yourself.");
  }

  const updated = await db.projectApproval.update({
    where: { id: approval.id },
    data: { status: decision, decidedAt: new Date(), decisionNote },
  });

  await db.auditEvent.create({
    data: {
      tenantId,
      actorId: decidedById,
      action: `PROJECT_APPROVAL_${decision}`,
      targetType: "ProjectApproval",
      targetId: approval.id,
      metadata: JSON.stringify({ decisionNote }),
    },
  });

  return updated;
}
```

Confirm `ProjectApproval.status` actually defaults to `"PENDING"` in the schema before shipping this â the guard's exact string needs to match whatever the model really uses.

### 1.2 One thing this doesn't fix, flagged rather than silently left

Unlike `workflow-engine.ts`'s `WorkflowDecision` table, `ProjectApproval` has no separate history table â the `AuditEvent` row this fix adds records *that* a decision happened and by whom, but a full before/after (if someone did contrive a second decision through some other path) still wouldn't be reconstructable from `ProjectApproval` alone the way workflow decisions are. Adding a `ProjectApprovalDecision` history table would be the more thorough fix, matching the workflow engine's shape exactly â I'm not proposing it here because the guard above makes a second decision impossible going forward, which removes the actual need for reconstructing one. Flag as a "what's next" item rather than building it pre-emptively for a scenario the guard already prevents.

### 1.3 Acceptance criteria
- [ ] A second `decideProjectApproval()` call against an already-decided approval throws, with the existing status named in the error.
- [ ] `requesterId === decidedById` is rejected (separation of duties), matching the sibling functions.
- [ ] An `AuditEvent` row is written on every decision.
- [ ] The legitimate single-decision path (pending â approved, or pending â rejected) is unaffected â verify with a test, since this function has no dedicated test today per the same coverage gap noted back in earlier phases.

---

## 2. Sequencing

One function â no tracks. Ship the guard, the audit call, and a test together.

## 3. Definition of Done for Phase 11

- [ ] `decideProjectApproval()` matches the status-guard/separation-of-duties/audit-trail shape already established by `decide()`, `decideAward()`, and `approveContract()`.
- [ ] A test proves the double-decide case is blocked.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

A `ProjectApprovalDecision` history table if a future requirement actually needs to reconstruct a full decision history (not just "was it decided, by whom, when") â not needed today since the guard added here prevents the scenario that would require it. And, as with Phase 10's closing note: this was found by checking one specific function against its closest siblings, not by a systematic sweep of every "decide"/"approve" function in the codebase â worth keeping in mind that a fourth or fifth instance of "the guard everyone else has, this one file doesn't" may still be out there.
