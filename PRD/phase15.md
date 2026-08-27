# Construction OS (Nesto) â PRD: Phase 15, Money as Float â Procurement & Contracts v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 14 (establishes the pattern and `src/lib/money.ts` this phase reuses)
**Scope:** Priority 2 from Phase 14's list â `Contract.value`, `SpendingBill.amount`, and the money fields on `PurchaseOrder`/`PurchaseOrderLine`/`SupplierQuotation`/`SupplierQuotationLine`. No new business modules.

---

## 0. What I found â and one distinction worth getting right before touching anything

Continuing Phase 14's own roadmap into its Priority 2 fields. Before applying the same mechanical fix, it's worth checking each field's actual meaning rather than assuming every `Float` in these models is money â some of them aren't, and converting those would be a real modeling mistake, not a fix.

`PurchaseOrderLine` and `SupplierQuotationLine` each have both money fields (`unitPrice`, `lineTotal`, `discount`, `tax`) **and** quantity fields (`quantity`, `deliveredQuantity`, `acceptedQuantity`, `rejectedQuantity`). Quantities represent physical amounts â 2.5 tons of cement, 10.75 meters of rebar â and legitimately need fractional precision that varies by unit of measure. They are not currency and should not be forced into integer minor units; that would solve a problem they don't have and break their actual one (representing a real-world fractional physical quantity). **This phase migrates the money fields only, explicitly leaves the quantity fields as `Float`,** and flags quantity precision as a separate, different concern outside this phase's scope if it's ever worth addressing.

The money fields, confirmed against the schema:

| Model | Money fields (migrate) | Non-money fields (leave alone) |
|---|---|---|
| `Contract` | `value` | â |
| `SpendingBill` | `amount` | â |
| `PurchaseOrder` | `amount`, `subtotal`, `discount`, `tax`, `freight` | â |
| `PurchaseOrderLine` | `unitPrice`, `discount`, `tax`, `lineTotal` | `quantity`, `deliveredQuantity`, `acceptedQuantity`, `rejectedQuantity` |
| `SupplierQuotation` | `subtotal`, `discount`, `tax`, `freight`, `total` | â |
| `SupplierQuotationLine` | `unitPrice`, `lineTotal` | `quantity` |

The concrete arithmetic this fixes is already visible in the code, not hypothetical:
```ts
// src/server/procurement.ts
const estimatedAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.estimatedUnitCost, 0);
const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
const committedSpend = purchaseOrders.filter(/* ... */).reduce((sum, po) => sum + po.amount, 0);
```
Every one of these `reduce` calls is exactly the kind of repeated floating-point addition that accumulates drift across a real company's PO history â the same shape of risk Phase 14 identified in payroll and invoicing, here on the procurement side of the ledger instead.

---

## 1. The fix â same pattern as Phase 14, applied to six models

### 1.1 One subtlety this phase adds: `quantity * unitPrice` when `unitPrice` is now an integer

```ts
// Before (Float throughout)
const lineTotal = quantity * unitPrice; // both float, drifts silently

// After (unitPriceMinor is an integer in minor units, quantity stays a
// float â this is a legitimate, single, deliberate rounding point, not an
// accumulation bug: real-world invoices round each line to the nearest
// cent exactly like this, once, on purpose)
import { toMinorUnits } from "@/lib/money";
const lineTotalMinor = Math.round(quantity * unitPriceMinor);
```
This is worth calling out explicitly so it isn't confused with the problem Phase 14 fixes: a single, intentional rounding operation at the point a fractional quantity meets a per-unit price is normal and correct in real accounting (nobody expects sub-cent line totals); the bug Phase 14/15 fix is *unrounded, repeated* float arithmetic silently drifting across many operations. `Math.round()` at this one boundary is the fix, not something to eliminate.

### 1.2 Migration steps â identical three-step pattern per field, run per model

```sql
-- Repeated per field, e.g. Contract.value:
ALTER TABLE "Contract" ADD COLUMN "valueMinor" INTEGER;
UPDATE "Contract" SET "valueMinor" = ROUND("value" * 100);
-- verify: SELECT count(*) FROM "Contract" WHERE "valueMinor" IS NULL â must be 0
ALTER TABLE "Contract" ALTER COLUMN "valueMinor" SET NOT NULL;
ALTER TABLE "Contract" DROP COLUMN "value";
```
For models with several money fields at once (`PurchaseOrder`, `SupplierQuotation`), do all of that model's fields in one migration rather than one per field â they're logically one unit of change (a PO's amount/subtotal/discount/tax/freight all need to stay mutually consistent through the same deploy), and splitting them across separate migrations risks a window where some are converted and others aren't.

### 1.3 Consumers to update

- `procurement.ts` â `estimatedAmount`/`subtotal` calculations (shown in Â§0), plus wherever `PurchaseOrder.amount` feeds `committedSpend` rollups.
- `procurement-comparison.ts` â `decideAward()` (Phase 12 already touched this function for its status guard; this is a second, independent edit to the same file) and the comparison-scoring logic that presumably compares supplier quotation totals against each other.
- `contract-lifecycle.ts` â `approveContract()`'s domain event payload includes `value: contract.value` (seen back in Phase 11's review of this function) â update to `valueMinor`, and check `contract-lifecycle-reactions.ts` on the receiving end of that event for the same field rename.
- `finance-spendings.ts` â `decideSpendingBill()` and whatever creates `SpendingBill` rows.

### 1.4 Acceptance criteria
- [ ] All six models' money fields (per the table in Â§0) migrated to `*Minor` integer columns; quantity fields explicitly untouched.
- [ ] `quantity * unitPriceMinor` line-total calculations use a single `Math.round()` at the multiplication point, not left as unrounded float multiplication.
- [ ] All consumer files in Â§1.3 updated to the new field names and integer arithmetic.
- [ ] The domain-event payload rename (`contract-lifecycle.ts` â `contract-lifecycle-reactions.ts`) is verified on both ends â a payload field rename that only updates the sender is a silent breakage on the receiving side, exactly the kind of thing Phase 6's reconciliation lesson (two correct-looking changes that don't compose) applies to here as well.

---

## 2. Sequencing

```
Contract.value              âââ smallest surface (one field, two known
                                 consumer files), do first
SpendingBill.amount          âââ similarly small, do second
PurchaseOrder + PurchaseOrderLine
  + SupplierQuotation + SupplierQuotationLine âââ do together, last â
                                 these four models are used jointly in the
                                 comparison/award flow, so migrating them
                                 in the same PR keeps that flow internally
                                 consistent rather than half-converted
                                 across a deploy boundary
```

## 3. Definition of Done for Phase 15

- [ ] Contract, spending, and procurement money fields are on integer minor units, matching Phase 14's established pattern.
- [ ] Quantity fields are confirmed untouched and still `Float`.
- [ ] The Contract-value domain event rename is verified consistent on both the emitting and receiving side.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

Phase 14's Priority 3 (inventory `unitCost`, `unit-pricing.ts`'s per-unit real-estate pricing fields) â same recipe again, lower urgency. And, separately from money entirely: the quantity-field precision question flagged in Â§0 (should `quantity`/`deliveredQuantity` etc. have a defined, unit-of-measure-aware precision rather than an unconstrained float) is a real question but a different one from anything this money-migration thread addresses â worth its own investigation if fractional-quantity rounding ever produces a visible discrepancy in practice, not before.
