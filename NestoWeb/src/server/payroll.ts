import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// PRD_HR_Payroll_Workforce — Phase 2 (Payroll). Scope decision 2026-08-06:
// tax/contribution calculation is deliberately PASS-THROUGH ONLY — every
// line's gross/net is copied straight from the employee's CURRENT
// SalaryRecord, the same numbers HR already manages today. No tax bracket or
// contribution-rate logic is invented here. A locked run does NOT post to
// Finance (Payroll computes, Finance posts — the PRD's own boundary,
// deferred, same shape as Inventory's posting-ready-events pattern).
//
// Immutability: DRAFT/CALCULATED runs can be recalculated freely (lines are
// replaced wholesale, never patched in place); once LOCKED a run's lines
// never change again. A correction is a new run with adjustsRunId pointing
// back at the locked one — never a reopen.
// ---------------------------------------------------------------------------

async function logPayrollActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  actorId: string | undefined,
  eventType: string,
  summary: string
) {
  return db.payrollActivity.create({ data: { tenantId, entityType, entityId, actorId, eventType, summary } });
}

export async function listCompaniesForPicker(tenantId: string) {
  return db.company.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function listPayrollGroups(tenantId: string) {
  return db.payrollGroup.findMany({ where: { tenantId }, include: { company: true }, orderBy: { name: "asc" } });
}

export async function createPayrollGroup(
  tenantId: string,
  input: { companyId: string; name: string; frequency?: string; currency?: string }
) {
  return db.payrollGroup.create({ data: { tenantId, ...input } });
}

export async function listPayrollRuns(tenantId: string, payrollGroupId?: string) {
  return db.payrollRun.findMany({
    where: { tenantId, ...(payrollGroupId ? { payrollGroupId } : {}) },
    include: { payrollGroup: true, lines: true },
    orderBy: { periodStart: "desc" },
  });
}

export async function createPayrollRun(
  tenantId: string,
  createdById: string,
  input: { payrollGroupId: string; periodStart: Date; periodEnd: Date; payDate: Date }
) {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({ data: { tenantId, createdById, ...input } });
    await logPayrollActivity(tenantId, "PayrollRun", run.id, createdById, "CREATED", "Payroll run created (draft)");
    return run;
  });
}

export async function getPayrollRunDetail(tenantId: string, runId: string) {
  const run = await db.payrollRun.findUnique({
    where: { id: runId },
    include: {
      payrollGroup: { include: { company: true } },
      createdBy: true,
      lockedBy: true,
      adjustsRun: true,
      adjustments: true,
      lines: { include: { employee: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!run || run.tenantId !== tenantId) return null;

  const activity = await db.payrollActivity.findMany({
    where: { tenantId, entityType: "PayrollRun", entityId: runId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });

  return { run, activity };
}

// Wholesale replace: recalculating a DRAFT/CALCULATED run deletes and
// re-derives every line rather than patching individual rows, so a run
// always reflects a single consistent calculation pass.
export async function calculatePayrollRun(tenantId: string, actorId: string, runId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: runId }, include: { payrollGroup: true } });
  if (!run || run.tenantId !== tenantId) throw new Error("Payroll run not found.");
  if (run.status === "LOCKED") throw new Error("A locked payroll run cannot be recalculated.");
  if (run.status === "CANCELLED") throw new Error("A cancelled payroll run cannot be recalculated.");

  // Active employment in this run's company, falling back to plain
  // Employee.status for rows that predate the EmploymentRelationship model
  // (additive adoption, same discipline as every other Phase-1 backfill).
  const [activeRelationships, employees] = await Promise.all([
    db.employmentRelationship.findMany({
      where: { tenantId, status: "ACTIVE", companyId: run.payrollGroup.companyId },
      include: { employee: true },
    }),
    db.employee.findMany({ where: { tenantId, status: "ACTIVE" } }),
  ]);

  const coveredEmployeeIds = new Set(activeRelationships.map((r) => r.employeeId));
  const fallbackEmployees = employees.filter((e) => !coveredEmployeeIds.has(e.id));

  type Candidate = { employeeId: string; employmentRelationshipId: string | null };
  const candidates: Candidate[] = [
    ...activeRelationships.map((r) => ({ employeeId: r.employeeId, employmentRelationshipId: r.id })),
    ...fallbackEmployees.map((e) => ({ employeeId: e.id, employmentRelationshipId: null })),
  ];

  return db.$transaction(async (tx) => {
    await tx.payrollRunLine.deleteMany({ where: { tenantId, payrollRunId: runId } });

    let linesCreated = 0;
    for (const candidate of candidates) {
      const currentSalary = await tx.salaryRecord.findFirst({
        where: { tenantId, employeeId: candidate.employeeId, status: "CURRENT" },
        orderBy: { effectiveStartDate: "desc" },
      });
      if (!currentSalary) continue; // no compensation on file — nothing to pay, skip rather than fabricate a figure

      await tx.payrollRunLine.create({
        data: {
          tenantId,
          payrollRunId: runId,
          employeeId: candidate.employeeId,
          employmentRelationshipId: candidate.employmentRelationshipId,
          salaryRecordId: currentSalary.id,
          grossSalary: currentSalary.grossSalary,
          netSalary: currentSalary.netSalary,
          currency: currentSalary.currency,
          calculationTrace: `source: SalaryRecord ${currentSalary.id} (effective ${currentSalary.effectiveStartDate.toISOString().slice(0, 10)}); formula: pass-through, no deductions applied; rounding: none`,
        },
      });
      linesCreated += 1;
    }

    const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: "CALCULATED" } });
    await logPayrollActivity(
      tenantId,
      "PayrollRun",
      runId,
      actorId,
      "CALCULATED",
      `Payroll run calculated — ${linesCreated} employee${linesCreated === 1 ? "" : "s"}`
    );
    return updated;
  });
}

export async function lockPayrollRun(tenantId: string, actorId: string, runId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: runId }, include: { lines: true } });
  if (!run || run.tenantId !== tenantId) throw new Error("Payroll run not found.");
  if (run.status !== "CALCULATED") throw new Error("Only a calculated payroll run can be locked.");
  if (run.lines.length === 0) throw new Error("Cannot lock a payroll run with no lines.");

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollRun.update({
      where: { id: runId },
      data: { status: "LOCKED", lockedById: actorId, lockedAt: new Date() },
    });
    await logPayrollActivity(tenantId, "PayrollRun", runId, actorId, "LOCKED", `Payroll run locked — ${run.lines.length} payslips issued`);
    return updated;
  });
}

export async function cancelPayrollRun(tenantId: string, actorId: string, runId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: runId } });
  if (!run || run.tenantId !== tenantId) throw new Error("Payroll run not found.");
  if (run.status === "LOCKED") throw new Error("A locked payroll run cannot be cancelled — issue an adjustment run instead.");

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: "CANCELLED" } });
    await logPayrollActivity(tenantId, "PayrollRun", runId, actorId, "CANCELLED", "Payroll run cancelled");
    return updated;
  });
}

// A correction to an already-LOCKED run is a brand-new DRAFT run in the same
// group, linked back via adjustsRunId — the locked run itself never reopens.
export async function createAdjustmentRun(
  tenantId: string,
  createdById: string,
  input: { adjustsRunId: string; payDate: Date; reason?: string }
) {
  const original = await db.payrollRun.findUnique({ where: { id: input.adjustsRunId } });
  if (!original || original.tenantId !== tenantId) throw new Error("Original payroll run not found.");
  if (original.status !== "LOCKED") throw new Error("Only a locked payroll run can be adjusted.");

  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: {
        tenantId,
        payrollGroupId: original.payrollGroupId,
        periodStart: original.periodStart,
        periodEnd: original.periodEnd,
        payDate: input.payDate,
        adjustsRunId: original.id,
        createdById,
      },
    });
    await logPayrollActivity(
      tenantId,
      "PayrollRun",
      run.id,
      createdById,
      "ADJUSTMENT_CREATED",
      `Adjustment run created for locked run ${original.id}${input.reason ? ` — ${input.reason}` : ""}`
    );
    return run;
  });
}

// Self-service: an employee's own locked payslips only. HR/Finance use
// getPayrollRunDetail for the full-run view instead.
export async function getEmployeePayslips(tenantId: string, employeeId: string) {
  return db.payrollRunLine.findMany({
    where: { tenantId, employeeId, payrollRun: { status: "LOCKED" } },
    include: { payrollRun: { include: { payrollGroup: true } } },
    orderBy: { createdAt: "desc" },
  });
}
