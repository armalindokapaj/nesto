# Construction OS (Nesto) â PRD: Phase 14, Money Stored as Floating-Point v1.0

**Status:** Draft for implementation â **strategic decision + phased migration plan, not a single PR**
**Owner:** Lindo (solo full-stack)
**Depends on:** none technically, but this is exactly the kind of change best done with Phase 0's CI and Phase 5's error monitoring already in place, given its size
**Scope:** every monetary field in `prisma/schema.prisma` â genuinely cross-cutting, and this PRD says so honestly rather than pretending otherwise.

---

## 0. What I found

`grep -c "Float\b" prisma/schema.prisma` returns **114**. `grep -c "Decimal\b"` returns **0**. Every monetary figure in this entire system â `Invoice.amount`, `PayrollRunLine.grossSalary`/`netSalary`, `Contract.value`, `SpendingBill` amounts, `unitCost` on inventory movements, unit pricing in `unit-pricing.ts` â is stored as an IEEE-754 double-precision float.

This is a different category of finding from anything else in this review. It's not a missing check or a misconfigured route â it's a foundational data-modeling choice, made consistently across the entire schema, that's well known to be wrong for money specifically:

```js
> 0.1 + 0.2
0.30000000000000004
> 19.99 * 3
59.97  // looks fine here, but not every combination is this lucky
```

Floating-point binary can't exactly represent most decimal fractions. A single arithmetic operation rarely produces a visibly wrong number, which is exactly why this kind of bug survives in production for years â it shows up as pennies of drift that accumulate over thousands of operations (`convertAmount()`'s currency conversion, `buildMonthlySeries()`'s invoice sum-by-month, every payroll run's `reduce`-style totals), not as an obvious crash. For a system that will eventually need to reconcile against a bank statement to the cent, "usually close enough" isn't the standard â and once a real company's accountant finds a one-cent discrepancy they can't explain, trust in every number the system produces takes the hit, not just the one field.

---

## 1. The decision: integer minor units, not Prisma's `Decimal` type

There are two standard fixes for this class of problem, and picking the wrong one here would be a real overengineering risk given the project's stated priorities:

**Option A â Prisma's `Decimal` type** (backed by Postgres `NUMERIC`). This is the more "textbook correct" answer, but it has a real ergonomic cost: Prisma returns `Decimal` fields as `decimal.js` objects, not plain JS numbers. Every consumer of every one of these 114 fields â every `.reduce()`, every comparison, every arithmetic expression across `finance.ts`, `payroll.ts`, `procurement.ts`, `analytics.ts`, and dozens more â would need to switch from plain number arithmetic to `Decimal.add()`/`.mul()`/`.toNumber()` calls, or the type system would constantly fight the existing code. That's a much larger, riskier, more invasive change than the problem requires.

**Option B â integer minor units (store cents, not euros).** Change each `Float` field to an `Int` (or `BigInt` for anything that could plausibly exceed ~21 million currency units, unlikely here) representing the smallest currency unit â `1999` instead of `19.99`. All arithmetic becomes plain integer math, which has no floating-point representation problem at all. The only discipline required is at the two boundaries: multiply by 100 when a user enters a decimal amount, divide by 100 when displaying one. This is the same approach Stripe, and most payment systems, use â not because it's clever, but because it's boring and correct, and it doesn't require introducing a new numeric type into every function that touches money.

**Recommendation: Option B.** It's a smaller conceptual change (an `Int` is still just a number everywhere in JS, unlike a `Decimal` object), it doesn't touch arithmetic logic meaningfully, and it matches this project's consistent preference for the simpler correct answer over the more academically complete one.

---

## 2. Why this is a phased migration plan, not a single PR

Being honest about scope: 114 fields, likely 200+ call sites doing arithmetic on them, and every existing row in every seeded/real database needs its value multiplied by 100 during migration. Attempting this in one PR would be exactly the kind of high-blast-radius change this project's own instincts (small, reviewable, sequenced changes) argue against. This phase defines the approach and does the highest-stakes slice; it explicitly does not claim to finish all 114 fields.

### 2.1 Migration pattern, demonstrated on one field

```prisma
// Before
model Invoice {
  amount Float
}

// After
model Invoice {
  amountMinor Int // amount in minor units (cents); e.g. 1999 = â¬19.99
}
```

```sql
-- Migration: add the new column, backfill, drop the old one â as three
-- separate migration steps (not one), so a bad backfill can be caught and
-- fixed before the old column is gone and the data is unrecoverable.
ALTER TABLE "Invoice" ADD COLUMN "amountMinor" INTEGER;
UPDATE "Invoice" SET "amountMinor" = ROUND("amount" * 100);
-- (verify: SELECT count(*) FROM "Invoice" WHERE "amountMinor" IS NULL â must be 0)
ALTER TABLE "Invoice" ALTER COLUMN "amountMinor" SET NOT NULL;
ALTER TABLE "Invoice" DROP COLUMN "amount";
```

```ts
// src/lib/money.ts â new, small, shared boundary helpers
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}
export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(fromMinorUnits(minor));
}
```
Every place that currently does `amount: input.amount` on create/update becomes `amountMinor: toMinorUnits(input.amount)` (assuming the input form still collects a decimal value from the user â the UI doesn't need to change, only the boundary conversion). Every place that currently sums/compares/displays `.amount` switches to `.amountMinor`, with display going through `formatMoney()` (which likely already exists in some form â `formatCurrency()` was referenced back in Phase 8's executive dashboard code; check whether to extend that function or the new `fromMinorUnits`/`formatMoney` pair should replace it, rather than ending up with two competing money-formatting utilities).

### 2.2 Priority order for this phase's actual scope

Not all 114 fields carry equal risk. Prioritize by (a) how directly the field feeds an external financial obligation, and (b) how much arithmetic is done on it (more arithmetic = more accumulated drift risk):

| Priority | Fields | Why |
|---|---|---|
| 1 | `PayrollRunLine.grossSalary`/`netSalary`, `Invoice.amount` | Direct pay and billing â the two places a one-cent drift becomes a real dispute with a real person or company. |
| 2 | `Contract.value`, `SpendingBill` amounts, `PurchaseOrder`/`Supplier` pricing fields | Feed into the same ledger eventually, heavy arithmetic in comparison/approval flows (Phase 12's `decideAward`/`approveContract` territory). |
| 3 | `unitCost` (inventory), unit-pricing fields (`unit-pricing.ts`) | Real money, but typically single-value lookups rather than heavily summed â lower drift risk, still worth migrating for consistency. |
| Later | Everything else | Migrate opportunistically as each module gets touched for other reasons, using the exact pattern this phase establishes â not urgent enough to block on. |

This phase's actual deliverable is **Priority 1** â the pattern proven end-to-end on the two highest-stakes fields â plus the `lib/money.ts` helpers and migration-script pattern that make Priority 2/3 a known, repeatable recipe for whoever (future you) tackles them next.

### 2.3 What doesn't change

`currency`, `CurrencyRate.rate` â an exchange rate is inherently a ratio, not a currency amount itself, and doesn't have the same "must equal a real coin count" property amounts do; leave it as `Float`/keep as-is unless a specific precision problem shows up in practice. Don't over-apply the pattern to fields that aren't actually money.

---

## 3. Testing

The kind of bug this phase fixes is specifically invisible in a quick manual check (both `19.99` and `1999/100` display as `"19.99"`) and only shows up after enough operations compound. Write the test to actually prove that: sum a set of `PayrollRunLine.grossSalary` values chosen to be float-adversarial (values like `0.1 + 0.2`-style fractions in cents-equivalent decimal form) both the old way and the new way, and assert the new (integer) sum is exact while demonstrating the old one wasn't â a concrete, falsifiable proof this migration fixes something real, not just a defensive style change.

## 4. Acceptance criteria (for this phase's Priority 1 scope)

- [ ] `PayrollRunLine.grossSalary`/`netSalary` and `Invoice.amount` migrated to integer minor-unit columns, following the three-step migration pattern in Â§2.1.
- [ ] `src/lib/money.ts` helpers exist and are used at every boundary (input conversion, display formatting) for the migrated fields.
- [ ] Every consumer of the migrated fields (`payroll.ts`'s calculation loop from Phase 2, `finance.ts`'s invoice queries, `executive.ts`'s revenue rollup from Phase 8) updated to the new field names and integer arithmetic.
- [ ] The float-adversarial test in Â§3 passes against the new columns and demonstrates the old behavior would have failed it.
- [ ] A production data backfill dry-run (count check, spot-check a sample of converted values against their originals) before the old columns are dropped for real.

## 5. Sequencing

```
lib/money.ts helpers          âââ do first, no dependencies
PayrollRunLine (Priority 1)    âââ do second â smaller blast radius than
                                    Invoice (fewer consuming files, per the
                                    earlier N+1 fix in Phase 2 already
                                    having mapped this function closely)
Invoice (Priority 1)           âââ do third â more consumers (finance.ts,
                                    finance-module.ts, analytics.ts,
                                    executive.ts), higher care needed
Priority 2/3                   âââ future phases, same recipe
```

## 6. Definition of Done for Phase 14

- [ ] Payroll and invoice amounts are stored as integers in minor units, with proven-correct arithmetic.
- [ ] A documented, repeatable pattern (schema change, migration script shape, helper library) exists for migrating the remaining ~110 fields opportunistically.
- [ ] No behavior change visible to users beyond eliminated rounding drift â this phase is a correctness fix, not a feature.
- [ ] Zero new business features shipped during this phase.

## 7. What comes next (not in scope here)

Migrating Priority 2 and 3 fields as their modules come up for other work, using this phase's exact pattern rather than re-deriving it. And a genuinely optional follow-up: once enough of the schema is on integer minor units, consider whether `formatCurrency()` (seen in Phase 8's dashboard) and this phase's `formatMoney()` should be consolidated into one function rather than two doing adjacent jobs â worth a look once both exist side by side, not before.
