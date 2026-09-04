# ADR-0013 — Workflow source-finalization handshake

**Status:** Accepted · 2026-09-04 · PRD §10.2, §28.16, Appendix D.13

## Context
"Approved" and "done" are different facts owned by different domains. If the workflow engine applies the
business transition itself, it must know every domain's rules — and the moment a record changed between
submission and approval, it applies them to the wrong version.

## Decision
Two phases, always:

1. **Request.** The source domain opens a `WorkflowInstance` pinned to `(sourceType, sourceId,
   sourceRecordVersion, definitionVersion)` and a submitted snapshot.
2. **Decide.** Participants act on `WorkflowWorkItem`s. Approval rights are resolved server-side from the
   work item, never from the request or from what the UI offered (§8.6). Decisions are immutable.
3. **Outcome.** The instance reaches `APPROVED`/`REJECTED` and emits `workflow.outcome.reached.v1`. **No
   business state has changed at this point.**
4. **Finalize.** The source domain consumes the outcome, re-validates the record still exists, is still at
   the pinned `recordVersion`, that the actor's authority still holds and that its own invariants pass,
   then applies the transition in its own transaction with its own audit and events.
5. **Confirm.** The source calls `workflow.confirmFinalization(instanceId, result)`. The instance closes as
   `FINALIZED` or `FINALIZATION_FAILED` with a reason.

Rules that fall out of this:
- A material change to the source while a workflow is open invalidates or restarts the instance according
  to the definition; the definition declares which field changes are material.
- An approver cannot edit the submitted snapshot through the decision screen.
- An instance stuck between step 3 and step 5 is visible and alertable — `outcome reached, not finalized`
  is a monitored metric, because it is the state where a user believes something happened and it has not.

## Consequences
- Workflow stays generic; no domain rule leaks into it.
- An approval can legitimately fail to apply, and the product says so explicitly instead of silently
  diverging.
