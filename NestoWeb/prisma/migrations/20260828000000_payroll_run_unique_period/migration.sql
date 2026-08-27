-- Phase 10 — one live payroll run per group per period.
--
-- A partial index rather than a plain UNIQUE constraint, for two reasons the
-- data model requires:
--   * a CANCELLED run can legitimately be re-created for the same period
--     (see cancelPayrollRun), so cancelled rows must not occupy the slot;
--   * an adjustment run deliberately covers its original's period, linked by
--     adjustsRunId (see createAdjustmentRun), so those are excluded too.
--
-- Prisma's schema DSL cannot express a partial index, so this is hand-written
-- SQL. The matching application-level check in createPayrollRun() produces the
-- friendly message; this index is what actually holds under two simultaneous
-- requests, where that check and its insert are separate statements.
CREATE UNIQUE INDEX "PayrollRun_one_live_run_per_period"
  ON "PayrollRun" ("tenantId", "payrollGroupId", "periodStart", "periodEnd")
  WHERE "status" <> 'CANCELLED' AND "adjustsRunId" IS NULL;
