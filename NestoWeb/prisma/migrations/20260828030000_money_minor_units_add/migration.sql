-- Phase 14 Priority 1 — money to integer minor units, for the two fields where
-- a one-cent drift becomes a real dispute with a real person or company:
-- payroll lines and invoices.
--
-- Deliberately split across two migrations. This one adds and backfills; the
-- next drops the old columns. A bad backfill is then catchable while the
-- original values still exist, rather than after they are unrecoverable.
ALTER TABLE "PayrollRunLine" ADD COLUMN "grossSalaryMinor" INTEGER;
ALTER TABLE "PayrollRunLine" ADD COLUMN "netSalaryMinor" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "amountMinor" INTEGER;

-- ROUND(x * 100) in Postgres NUMERIC, not float arithmetic: casting first means
-- the scaling itself is exact, so a stored 1.005 becomes 101 rather than the
-- 100 that binary floating point would truncate it to.
UPDATE "PayrollRunLine" SET "grossSalaryMinor" = ROUND("grossSalary"::numeric * 100);
UPDATE "PayrollRunLine" SET "netSalaryMinor"  = ROUND("netSalary"::numeric  * 100);
UPDATE "Invoice"        SET "amountMinor"     = ROUND("amount"::numeric     * 100);

-- Fails loudly here if any row did not backfill, while the source columns
-- still exist to diagnose against.
ALTER TABLE "PayrollRunLine" ALTER COLUMN "grossSalaryMinor" SET NOT NULL;
ALTER TABLE "PayrollRunLine" ALTER COLUMN "netSalaryMinor" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "amountMinor" SET NOT NULL;
