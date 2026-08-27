import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";
import { toMinorUnits } from "@/lib/money";

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

// `client` defaults to the top-level `db` for call sites outside a
// transaction, but MUST be passed the active `tx` when called from inside
// `db.$transaction(async (tx) => ...)` — writing through `db` there opens a
// second connection that waits on the still-open outer transaction's lock
// (SQLite serializes writers), which deadlocks until Prisma's 5s
// interactive-transaction timeout kills the outer transaction.
async function logPayrollActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  actorId: string | undefined,
  eventType: string,
  summary: string,
  client: Prisma.TransactionClient | typeof db = db
) {
  return client.payrollActivity.create({ data: { tenantId, entityType, entityId, actorId, eventType, summary } });
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

/** Raised by both the pre-check and the unique index, so callers see one message. */
class PayrollRunExistsError extends Error {
  constructor(status?: string) {
    super(
      status
        ? `A payroll run for this period already exists (status: ${status}).`
        : "A payroll run for this period already exists."
    );
    this.name = "PayrollRunExistsError";
  }
}

export async function createPayrollRun(
  tenantId: string,
  createdById: string,
  input: { payrollGroupId: string; periodStart: Date; periodEnd: Date; payDate: Date }
) {
  // Phase 10 — nothing stopped a double-click, or two admins who each thought
  // they were starting this month's run, from creating two DRAFT runs for the
  // same group and period. calculatePayrollRun() and lockPayrollRun() only ever
  // check an individual run's own status, never whether a sibling covers the
  // same period, so both could be calculated and locked: two sets of
  // PayrollRunLine rows, and people paid twice.
  //
  // Two layers on purpose. This query gives a clear, specific message on the
  // ordinary path; the partial unique index added alongside it
  // (20260828000000_payroll_run_unique_period) is what actually holds, because
  // this read and the insert below are separate statements and two simultaneous
  // requests would both find nothing. A plain @@unique in the schema would not
  // work here: a CANCELLED run can legitimately be re-created, and an
  // adjustment run deliberately shares its original's period — hence a partial
  // index excluding both, which Prisma's DSL cannot express.
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.payrollRun.findFirst({
        where: {
          tenantId,
          payrollGroupId: input.payrollGroupId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          adjustsRunId: null,
          status: { not: "CANCELLED" },
        },
      });
      if (existing) {
        throw new PayrollRunExistsError(existing.status);
      }
      const run = await tx.payrollRun.create({ data: { tenantId, createdById, ...input } });
      await logPayrollActivity(tenantId, "PayrollRun", run.id, createdById, "CREATED", "Payroll run created (draft)", tx);
      return run;
    });
  } catch (err) {
    // The index fired instead of the query above — same situation, same message.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      throw new PayrollRunExistsError();
    }
    throw err;
  }
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

  // Phase 2 Track B — this used to run one findFirst plus one create per
  // employee, sequentially, INSIDE the transaction. For a run covering a few
  // hundred people that is many hundreds of round-trips held inside a single
  // open transaction in one serverless invocation: a real risk against both
  // the function duration limit and Neon's pooler, which long-held
  // transactions are precisely what pooling handles worst.
  //
  // No job queue needed, and none added — this was an N+1, not a workload too
  // big for one request. Every salary is now read in one query outside the
  // transaction, and the lines are written with a single createMany, so the
  // transaction holds two statements regardless of headcount.
  const salaries = await db.salaryRecord.findMany({
    where: { tenantId, employeeId: { in: candidates.map((c) => c.employeeId) }, status: "CURRENT" },
    orderBy: { effectiveStartDate: "desc" },
  });
  // findMany returns newest first, so the first row seen per employee is the
  // one findFirst + orderBy desc would have picked.
  const currentByEmployee = new Map<string, (typeof salaries)[number]>();
  for (const salary of salaries) {
    if (!currentByEmployee.has(salary.employeeId)) currentByEmployee.set(salary.employeeId, salary);
  }

  const lines = candidates.flatMap((candidate) => {
    const currentSalary = currentByEmployee.get(candidate.employeeId);
    // No compensation on file — nothing to pay, skip rather than fabricate a figure.
    if (!currentSalary) return [];
    return [{
      tenantId,
      payrollRunId: runId,
      employeeId: candidate.employeeId,
      employmentRelationshipId: candidate.employmentRelationshipId,
      salaryRecordId: currentSalary.id,
      // SalaryRecord is still Float (Priority 3); this is the conversion
      // boundary, so everything downstream of a payroll line is exact.
      grossSalaryMinor: toMinorUnits(currentSalary.grossSalary, currentSalary.currency),
      netSalaryMinor: toMinorUnits(currentSalary.netSalary, currentSalary.currency),
      currency: currentSalary.currency,
      calculationTrace: `source: SalaryRecord ${currentSalary.id} (effective ${currentSalary.effectiveStartDate.toISOString().slice(0, 10)}); formula: pass-through, no deductions applied; rounding: none`,
    }];
  });

  return db.$transaction(async (tx) => {
    await tx.payrollRunLine.deleteMany({ where: { tenantId, payrollRunId: runId } });
    if (lines.length > 0) await tx.payrollRunLine.createMany({ data: lines });
    const linesCreated = lines.length;

    const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: "CALCULATED" } });
    await logPayrollActivity(
      tenantId,
      "PayrollRun",
      runId,
      actorId,
      "CALCULATED",
      `Payroll run calculated — ${linesCreated} employee${linesCreated === 1 ? "" : "s"}`,
      tx
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
    await logPayrollActivity(tenantId, "PayrollRun", runId, actorId, "LOCKED", `Payroll run locked — ${run.lines.length} payslips issued`, tx);
    // Phase 1 Track B — payroll wrote no AuditEvent at all. Locking is the
    // moment payslips become real, so it is the one to record.
    await logAudit({ tenantId, actorId, action: "payroll.run.locked", targetType: "PayrollRun", targetId: runId,
      metadata: { payrollGroupId: run.payrollGroupId, lines: run.lines.length, periodStart: run.periodStart, periodEnd: run.periodEnd } }, tx);
    return updated;
  });
}

export async function cancelPayrollRun(tenantId: string, actorId: string, runId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: runId } });
  if (!run || run.tenantId !== tenantId) throw new Error("Payroll run not found.");
  if (run.status === "LOCKED") throw new Error("A locked payroll run cannot be cancelled — issue an adjustment run instead.");

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: "CANCELLED" } });
    await logPayrollActivity(tenantId, "PayrollRun", runId, actorId, "CANCELLED", "Payroll run cancelled", tx);
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
      `Adjustment run created for locked run ${original.id}${input.reason ? ` — ${input.reason}` : ""}`,
      tx
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
