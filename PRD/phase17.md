# Construction OS (Nesto) â PRD: Phase 17, Unit Archive Bypasses the Sales State Machine v1.0

**Status:** Draft for implementation â **treat as high priority; same customer-facing stakes as Phase 16**
**Owner:** Lindo (solo full-stack)
**Depends on:** none â same file, same subsystem as Phase 16, continuing straight from its own "what's next"
**Scope:** three functions in `src/server/units.ts` â `archiveUnit()`, `transitionUnitStatus()`, `restoreUnit()`. No new business modules.

---

## 0. What I found

Following Phase 16's own closing note â check the rest of `Unit.lifecycleStatus`'s write paths, not just `recordUnitSale()` â turned up something sharper than "another missing check." This codebase has a real, formal state machine for unit lifecycle transitions, correctly enforced in one function, and **completely bypassed by a second function that reaches the exact same forbidden outcome a different way.**

```ts
// src/lib/constants.ts â the actual, deliberate state machine
export const UNIT_MANUAL_TRANSITIONS: Record<UnitLifecycleStatus, UnitLifecycleStatus[]> = {
  DRAFT: ["AVAILABLE", "NOT_FOR_SALE", "ARCHIVED"],
  AVAILABLE: ["NOT_FOR_SALE", "COMPANY_OWNED", "RENTED", "ARCHIVED"],
  ON_HOLD: [],
  RESERVED: [],
  CONTRACTED: [],
  SOLD: [],
  HANDED_OVER: [],
  NOT_FOR_SALE: ["AVAILABLE", "COMPANY_OWNED", "ARCHIVED"],
  COMPANY_OWNED: ["AVAILABLE", "RENTED", "ARCHIVED"],
  RENTED: ["COMPANY_OWNED", "AVAILABLE"],
  ARCHIVED: [],
};
```

Read this table literally: a unit that's `ON_HOLD`, `RESERVED`, `CONTRACTED`, `SOLD`, or `HANDED_OVER` has **zero** legal manual transitions â not even to `ARCHIVED`. That's a deliberate design decision (you can't manually meddle with a unit that's actively in someone's sales pipeline), and `transitionUnitStatus()` enforces it correctly:

```ts
export async function transitionUnitStatus(tenantId: string, unitId: string, actorId: string, nextStatus: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const allowed = UNIT_MANUAL_TRANSITIONS[unit.lifecycleStatus as UnitLifecycleStatus] ?? [];
  if (!allowed.includes(nextStatus as UnitLifecycleStatus)) {
    throw new Error(`Cannot move a unit from ${unit.lifecycleStatus} to ${nextStatus} without the sales workflow (holds/reservations/contracts).`);
  }
  await db.unit.update({ where: { id: unitId }, data: { lifecycleStatus: nextStatus, version: { increment: 1 } } });
  // ...
}
```

**`archiveUnit()`, a few lines further down the same file, doesn't go through this table at all:**

```ts
export async function archiveUnit(tenantId: string, unitId: string, actorId: string) {
  assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  await db.unit.update({ where: { id: unitId }, data: { archivedAt: new Date(), lifecycleStatus: "ARCHIVED", version: { increment: 1 } } });
  await logUnitActivity(tenantId, unitId, actorId, "ARCHIVED", "Unit archived.");
}
```

This function checks only that the unit exists in the tenant, then unconditionally sets `lifecycleStatus: "ARCHIVED"`. A `SOLD` unit â one with a real client and a real `ClientUnitRelationship` "PURCHASED" row, exactly the record Phase 16 protects â can be archived through this function with no error, no warning, and no relationship to the fact that this exact transition (`SOLD` â `ARCHIVED`) is explicitly listed as forbidden three lines away in `constants.ts`. Archiving presumably hides a unit from the main sales listings and reports (per its usage in `units.ts`'s status-bucket logic from Phase 4/16's review) â so this is a real, practical way for an already-sold unit to disappear from a project's live unit list while the client who owns it has no idea.

**A second, smaller pattern gap in the same neighborhood:** two functions above `transitionUnitStatus()`, `updateUnit()` already does exactly the version-checked concurrency guard Phase 16 recommended adding to `recordUnitSale()`:

```ts
const result = await db.unit.updateMany({ where: { id: unitId, version }, data: { /* ... */ } });
if (result.count === 0) throw new Error(`This unit was changed by someone else (currently at version ${existing.version}). Reload and try again.`);
```

This is genuinely good confirmation that the fix recommended in Phase 16 is the house pattern, not an invented one â it's sitting right here, just not applied to `transitionUnitStatus()`, `archiveUnit()`, or `restoreUnit()`, all of which still use a plain `update()` with no version check despite each one incrementing `version`.

---

## 1. The fix

### 1.1 Route `archiveUnit()` through the transition table instead of duplicating (and bypassing) it

The simplest, most DRY fix â and the one least likely to drift out of sync with the table again â is for `archiveUnit()` to stop writing `lifecycleStatus` directly and instead call the function that already knows the rules:

```ts
export async function archiveUnit(tenantId: string, unitId: string, actorId: string) {
  await transitionUnitStatus(tenantId, unitId, actorId, "ARCHIVED");
  await db.unit.update({ where: { id: unitId }, data: { archivedAt: new Date() } });
  await logUnitActivity(tenantId, unitId, actorId, "ARCHIVED", "Unit archived.");
}
```
This means archiving a `SOLD`/`RESERVED`/`CONTRACTED`/etc. unit now throws the same clear error `transitionUnitStatus()` already produces for any other forbidden transition â no separate error message to maintain, no second copy of the rule to keep in sync with `constants.ts` if the table ever changes.

### 1.2 Bring `transitionUnitStatus()` (and, via 1.1, `archiveUnit()`) up to the same concurrency-safety level as `updateUnit()`

```ts
export async function transitionUnitStatus(tenantId: string, unitId: string, actorId: string, nextStatus: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const allowed = UNIT_MANUAL_TRANSITIONS[unit.lifecycleStatus as UnitLifecycleStatus] ?? [];
  if (!allowed.includes(nextStatus as UnitLifecycleStatus)) {
    throw new Error(`Cannot move a unit from ${unit.lifecycleStatus} to ${nextStatus} without the sales workflow (holds/reservations/contracts).`);
  }
  const result = await db.unit.updateMany({
    where: { id: unitId, version: unit.version, lifecycleStatus: unit.lifecycleStatus },
    data: { lifecycleStatus: nextStatus, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new Error(`This unit was changed by someone else. Reload and try again.`);
  }
  await logUnitActivity(tenantId, unitId, actorId, "STATUS_CHANGED", `Status changed from ${unit.lifecycleStatus} to ${nextStatus}.`);
}
```
Including `lifecycleStatus: unit.lifecycleStatus` in the `where` clause (in addition to `version`) is a small but real extra safety margin here specifically, since this function's whole job is a status-conditional transition â belt-and-suspenders alongside the version check, at negligible cost.

### 1.3 `restoreUnit()` â lower stakes, same treatment for consistency

`restoreUnit()` already has one real check (the unit-code conflict check) that the other two don't need â it's doing something right that's worth keeping exactly as-is. It should still pick up the same `updateMany`-with-version pattern for its own write, purely for consistency with its two siblings now that both are fixed:
```ts
const result = await db.unit.updateMany({
  where: { id: unitId, version: unit.version },
  data: { archivedAt: null, lifecycleStatus: "DRAFT", version: { increment: 1 } },
});
if (result.count === 0) throw new Error("This unit was changed by someone else. Reload and try again.");
```

### 1.4 Acceptance criteria
- [ ] Archiving a `SOLD`, `RESERVED`, `CONTRACTED`, `ON_HOLD`, or `HANDED_OVER` unit is rejected with the same clear error `transitionUnitStatus()` already produces for other forbidden transitions.
- [ ] Archiving a `DRAFT`/`AVAILABLE`/`NOT_FOR_SALE`/`COMPANY_OWNED` unit (the states the table actually allows) still works exactly as before.
- [ ] `transitionUnitStatus()`, `archiveUnit()` (via 1.1), and `restoreUnit()` all use the version-checked `updateMany` pattern already established by `updateUnit()`.
- [ ] A test proves the specific bypass this phase closes: attempt to archive a unit with `lifecycleStatus: "SOLD"` directly through `archiveUnit()` and confirm it's rejected â this is the one test in this phase that would have failed before the fix and passes after, the clearest possible proof the bug was real.

---

## 2. Sequencing

```
1.1 (archiveUnit routes through transitionUnitStatus) âââ do first â this
     is the actual bug; everything else is consistency hardening around it
1.2 (transitionUnitStatus version guard)               âââ second, since
     1.1 depends on this function anyway
1.3 (restoreUnit version guard)                         âââ last, lowest
     stakes, pure consistency
```

## 3. Definition of Done for Phase 17

- [ ] `archiveUnit()` can no longer reach a `lifecycleStatus` value the transition table forbids.
- [ ] All three unit-status-writing functions in this file use the same version-checked concurrency pattern as `updateUnit()`.
- [ ] The specific regression test (archive a `SOLD` unit, expect rejection) is in place and passes.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

This is now the third time in three consecutive phases (16, 17) that the fix has been "route through the function/pattern that's already correct nearby" rather than inventing something new â worth treating that as a standing instruction for any future `Unit.lifecycleStatus` write this project adds: it goes through `transitionUnitStatus()`, full stop, never a direct `db.unit.update()` on that field. And, one level out: `bulkUpdateUnits()` (seen adjacent to these functions in `units.ts`) wasn't checked in this phase â given the pattern found here, it's a reasonable next place to look for the same class of gap, since a bulk operation is exactly the kind of code that's tempting to write as a fast, direct update bypassing whatever single-record safety logic exists elsewhere.
