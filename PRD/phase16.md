# Construction OS (Nesto) â PRD: Phase 16, Double-Sale Protection for Units v1.0

**Status:** Draft for implementation â **treat as high priority; this is a real-estate sales integrity bug**
**Owner:** Lindo (solo full-stack)
**Depends on:** none â fresh subsystem (CRM/sales), same bug family as Phases 10â12
**Scope:** one function, `recordUnitSale()` in `src/server/crm-module.ts` â no new business modules.

---

## 0. What I found

Checking a fresh subsystem against the now-familiar question from Phases 10â12 â does a state-changing action check the current state before proceeding, or does it just overwrite â and this codebase's own sibling function shows exactly what the right answer looks like, right in the same file:

```ts
// src/server/crm-module.ts â createReservation(), correct
export async function createReservation(tenantId: string, input: { /* ... */ }) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");
  if (unit.lifecycleStatus !== "AVAILABLE" && unit.lifecycleStatus !== "ON_HOLD") {
    throw new Error(`This unit is ${unit.lifecycleStatus.toLowerCase().replace("_", " ")}, not available to reserve.`);
  }
  // ...create the reservation, set status to RESERVED...
}
```

```ts
// src/server/crm-module.ts â recordUnitSale(), no equivalent check
export async function recordUnitSale(tenantId: string, input: { /* ... */ }) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");

  return db.$transaction(async (tx) => {
    // ...converts any active reservation, creates a PURCHASED/RENTED relationship...
    await tx.unit.update({
      where: { id: unit.id },
      data: { lifecycleStatus: input.type === "PURCHASED" ? "SOLD" : "RENTED", version: { increment: 1 } },
    });
    // ...
  });
}
```

`Unit.lifecycleStatus` (per the schema and its own usage elsewhere in this exact file) has a real sales lifecycle: `AVAILABLE`, `ON_HOLD`, `RESERVED`, `CONTRACTED`, `SOLD`, `HANDED_OVER`, `COMPANY_OWNED`, `RENTED`. **`recordUnitSale()` â the actual final sale, a higher-stakes action than a reservation â has no check on any of them.** It unconditionally sets `lifecycleStatus` to `SOLD`/`RENTED` regardless of whether the unit is already `SOLD`, `RENTED`, `CONTRACTED`, or already `HANDED_OVER` to someone else entirely. Two salespeople independently recording a sale for the same unit to two different clients â a double-click, a miscommunication, a race between two people working the same project â both succeed, both create a valid-looking `ClientUnitRelationship` "PURCHASED" row, and nothing in the system ever notices two people now believe they own the same apartment.

This is worth naming precisely as the highest-stakes finding of this specific bug family so far: Phase 10's payroll duplicate and Phase 11/12's approval flips are internal financial/governance integrity problems; this one is a customer-facing outcome â an actual client being told they've purchased a unit that's already sold, discovered only when both buyers show up to the same handover.

**One more detail worth naming:** `Unit` has a `version` field, incremented on every lifecycle-status change (`version: { increment: 1 }`) â this looks like optimistic-concurrency-control scaffolding, but it isn't actually being used as one. Real optimistic locking requires the *update's* `where` clause to include the expected version (`where: { id, version: expectedVersion }`), so a second concurrent update targeting a stale version fails instead of silently succeeding. As written here, `where: { id: unit.id }` never checks version at all â the field increments, but nothing ever reads it back to guard a write. It's present but not doing its job.

---

## 1. The fix

### 1.1 Add the same guard `createReservation()` already has, adapted for the sale's own valid starting states

```ts
export async function recordUnitSale(
  tenantId: string,
  input: { clientId: string; unitId: string; type: "PURCHASED" | "RENTED"; /* ...rest unchanged... */ }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");

  // A sale is valid from AVAILABLE (walk-up sale, no prior reservation),
  // ON_HOLD, or RESERVED (the normal path â reserved, then converted to a
  // sale). Anything else means someone already has this unit.
  const validStartStates = ["AVAILABLE", "ON_HOLD", "RESERVED"];
  if (!validStartStates.includes(unit.lifecycleStatus)) {
    throw new Error(`This unit is already ${unit.lifecycleStatus.toLowerCase().replace("_", " ")} and cannot be sold again.`);
  }

  return db.$transaction(async (tx) => { /* ...unchanged... */ });
}
```

### 1.2 Close the race properly: make the update itself conditional, not just the pre-check

The check in Â§1.1 closes the common case (two sequential requests, the second sees the already-updated status) but not a genuine simultaneous race (two transactions both read `AVAILABLE` before either commits). Since `Unit.version` already exists for exactly this purpose, use it as intended instead of leaving it decorative:

```ts
return db.$transaction(async (tx) => {
  // ...existing reservation-conversion and ClientUnitRelationship.create logic...

  const updateResult = await tx.unit.updateMany({
    where: { id: unit.id, version: unit.version, lifecycleStatus: { in: validStartStates } },
    data: { lifecycleStatus: input.type === "PURCHASED" ? "SOLD" : "RENTED", version: { increment: 1 } },
  });
  if (updateResult.count === 0) {
    // Someone else's transaction won the race between our read and this
    // write â abort instead of leaving a ClientUnitRelationship row
    // pointing at a unit we didn't actually manage to claim.
    throw new Error("This unit was just sold or reserved by someone else. Please refresh and try again.");
  }

  // ...rest unchanged...
});
```
`updateMany` (rather than `update`) is the right tool here specifically because it returns a count instead of throwing when zero rows match â that count is exactly the race-detection signal needed, and it composes correctly inside the existing `$transaction`.

### 1.3 Acceptance criteria
- [ ] A sale attempted against a unit that's already `SOLD`/`RENTED`/`CONTRACTED`/`HANDED_OVER` is rejected with a clear error naming the current state.
- [ ] A genuine race â two `recordUnitSale()` calls for the same unit issued concurrently â results in exactly one success and one clean rejection, not two successful sales. This needs an actual concurrency test (two promises fired together against the same seeded unit), not just a sequential test, since that's the specific failure mode Â§1.1 alone doesn't close.
- [ ] The legitimate reservation-to-sale conversion path (the common case) is unaffected â verify explicitly, since it's the majority of real sales and shouldn't get harder to complete.
- [ ] `Unit.version` is genuinely used as an optimistic-lock guard in this function going forward â consider whether other functions writing `lifecycleStatus` (`createReservation()` itself, and the cancel/release counterpart around line 493) should get the same `updateMany` treatment, since right now only the pre-check exists there too, not the race-proof version.

---

## 2. Sequencing

Single function, single file. Ship Â§1.1 and Â§1.2 together â the pre-check alone gives a false sense of safety without the conditional update backing it up, and shipping only half would be worse than shipping neither, since it would look fixed without actually closing the race.

## 3. Definition of Done for Phase 16

- [ ] `recordUnitSale()` cannot succeed against a unit that's already sold, rented, contracted, or handed over.
- [ ] The race condition is closed via a version-checked conditional update, not just a pre-check.
- [ ] A concurrency test proves it.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

Auditing `createReservation()` and the reservation-release function (around line 493) for the same race-proofing â they have the right pre-check already (unlike `recordUnitSale()` before this fix), but neither uses `Unit.version` as a real concurrency guard on the write itself, so the same simultaneous-race gap likely exists there too, just for a lower-stakes outcome (double-reserving vs. double-selling). And, echoing the running theme across Phases 10â12 and now 16: this was found by comparing one function to its closest sibling in the same file, not a systematic sweep of every place `Unit.lifecycleStatus` gets written â worth checking `unit-import.ts` and any bulk-update path for the same gap, since a bulk import bypassing this check entirely would undo the fix for any unit touched that way.
