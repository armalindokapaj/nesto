-- Phase 14 Priority 1, step two — drop the float columns now that the minor-unit
-- columns are populated and NOT NULL. Separate from the backfill on purpose.
ALTER TABLE "PayrollRunLine" DROP COLUMN "grossSalary";
ALTER TABLE "PayrollRunLine" DROP COLUMN "netSalary";
ALTER TABLE "Invoice" DROP COLUMN "amount";
