# Construction OS (Nesto) â PRD: Phase 20, Asset Transfers Don't Update the Asset v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** none â fresh subsystem (Assets Module), same evidentiary shape as Phases 16/17: one function does it right, its closest sibling doesn't
**Scope:** one function, `transferAsset()` in `src/server/assets-module.ts`. No new business modules.

---

## 0. What I found

`src/server/assets-module.ts` is otherwise a carefully built module â `transitionAsset()` and `transitionWorkOrder()` both correctly consult a real transition table (`canTransitionAsset()`/`canTransitionWorkOrder()`) before allowing a status change, matching the exact pattern found correct in `units.ts` back in Phase 17. `assignAsset()` is the closest sibling to this phase's finding, and it does its job completely: when an asset is assigned to someone, it closes out any prior open assignment, creates the new one, **and updates the asset's own current-state fields** (`status`, `projectId`, `currentLocation`, `custodianId`) in the same transaction:

```js
export async function assignAsset(tenantId, actorId, id, input) {
  const row = assertTenant(await db.asset.findUnique({ where: { id }, include: { assignments: { where: { returnedAt: null } } } }), tenantId, "Asset");
  if (row.status === "MAINTENANCE" || row.status === "OUT_OF_SERVICE") throw new Error("This asset is not available for assignment.");
  // ...
  await db.$transaction([
    db.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date() } }),
    db.assetAssignment.create({ data: { tenantId, assetId: id, createdById: actorId, assignedAt: new Date(), ...input } }),
    db.asset.update({ where: { id }, data: { status: "ASSIGNED", projectId: input.projectId, currentLocation: input.location, custodianId: input.assigneeId, recordVersion: { increment: 1 } } }),
  ]);
  // ...
}
```

**`transferAsset()`, right below it, records that a transfer happened and never touches the asset at all:**

```js
export async function transferAsset(tenantId, actorId, id, input) {
  const row = assertTenant(await db.asset.findUnique({ where: { id } }), tenantId, "Asset");
  if (["DISPOSED", "ARCHIVED"].includes(row.status)) throw new Error("Disposed or archived assets cannot be transferred.");
  const number = await allocateNumber(tenantId, "ASSET_TRANSFER");
  const transfer = await db.assetTransfer.create({ data: { tenantId, assetId: id, createdById: actorId, number, ...input } });
  await activity(tenantId, actorId, id, "asset.transferred", `${number}: ${input.fromName} to ${input.toName}.`, undefined, undefined, input);
  return transfer;
}
```

`AssetTransfer` has no `status` field and its own `transferredAt` is set at creation time â it's modeled as a record of something that already happened, not a pending request awaiting separate confirmation. That means there's no second step anywhere that's supposed to later apply the transfer to the asset â `transferAsset()` is the only place that could do it, and it doesn't. After a transfer is logged, `Asset.currentLocation`, `Asset.custodianId`, and `Asset.ownershipCompanyId` still show whatever they were *before* the transfer â indefinitely, until someone separately calls `assignAsset()` (a different function, with a different, custodian-specific input shape that doesn't map cleanly onto a company-to-company ownership transfer) or edits the asset by hand.

Practically: run an assets report, or open the asset's detail page, right after recording a transfer of a piece of equipment from one project to another (or one owning company to another) â it still shows the *old* project/owner. The transfer log says it moved; the asset's own record disagrees.

---

## 1. The fix

### 1.1 Apply the corresponding update based on `toType`, in the same transaction as the transfer record

```js
export async function transferAsset(tenantId, actorId, id, input) {
  const row = assertTenant(await db.asset.findUnique({ where: { id } }), tenantId, "Asset");
  if (["DISPOSED", "ARCHIVED"].includes(row.status)) throw new Error("Disposed or archived assets cannot be transferred.");

  const number = await allocateNumber(tenantId, "ASSET_TRANSFER");

  // Mirror assignAsset()'s pattern: the field that actually changes depends
  // on what kind of transfer this is. A transfer between custodians is the
  // same underlying fact assignAsset() records (who currently has it); a
  // transfer between owning companies or projects touches different fields.
  const assetUpdate =
    input.toType === "COMPANY"
      ? { ownershipCompanyId: input.toId, ownershipCompanyName: input.toName }
      : input.toType === "PROJECT"
      ? { projectId: input.toId }
      : input.toType === "LOCATION"
      ? { currentLocation: input.toName }
      : input.toType === "CUSTODIAN"
      ? { custodianId: input.toId }
      : {};

  const [transfer] = await db.$transaction([
    db.assetTransfer.create({ data: { tenantId, assetId: id, createdById: actorId, number, ...input } }),
    db.asset.update({ where: { id }, data: { ...assetUpdate, recordVersion: { increment: 1 } } }),
  ]);

  await activity(tenantId, actorId, id, "asset.transferred", `${number}: ${input.fromName} to ${input.toName}.`, undefined, undefined, input);
  return transfer;
}
```
Confirm the actual set of `toType` values used in practice (the schema just types it as a plain `String`, so check the UI/form that populates this field for the real value set) before finalizing the mapping above â the four shown are a reasonable guess based on the fields `Asset` actually has, not a confirmed enum.

### 1.2 One thing worth deciding rather than assuming: does a transfer need the same `recordVersion` race protection as `assignAsset()`?

Neither `transferAsset()` nor `assignAsset()` currently checks `recordVersion` before writing (both increment it, neither conditions the write on its current value) â this is the same gap Phase 17 found and fixed for `Unit.version`, just not yet looked at for `Asset.recordVersion`. Worth doing the identical `updateMany`-with-version-check treatment here too, but that's a separate, smaller finding from this phase's main one (transfers not updating the asset at all) â flagged for the same fix, not bundled into this phase's core scope so the two changes can be reviewed independently.

### 1.3 Acceptance criteria
- [ ] After `transferAsset()` runs, `getAsset()` reflects the new location/custodian/owning company immediately â not just the transfer log entry.
- [ ] The `toType` â field mapping is verified against the actual UI/form values in use, not assumed from the schema alone.
- [ ] `assignAsset()`'s existing behavior is unaffected â this phase only changes `transferAsset()`.
- [ ] A test creates an asset, transfers it, and asserts the asset's own record (not just the `AssetTransfer` history) shows the new state.

---

## 2. Sequencing

Single function, single file. Ship the field-mapping fix (Â§1.1) first and independently; treat Â§1.2's version-guard as an optional, separately-reviewable addition to the same PR or a fast follow-up, since it's a different (concurrency) concern from this phase's core bug (missing update entirely).

## 3. Definition of Done for Phase 20

- [ ] `transferAsset()` updates the asset's own current-state fields to match what the transfer records.
- [ ] The fix is verified against real `toType` values, not guessed ones.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

`Asset.recordVersion` getting the same `updateMany`-with-version-check treatment `Unit.version` received in Phase 17, across `assignAsset()`, `transitionAsset()`, and `transferAsset()` alike â a real gap, just a different one from this phase's core finding, and worth its own focused pass rather than folding a concurrency fix into a phase about a missing state update. Beyond that: this module (assets, work orders, calibrations, warranties, insurance) has enough surface that it's worth the same kind of sibling-comparison sweep Phase 12 did for approval guards â this phase found one gap by reading the file start to finish, not by systematically checking every function against every other.
