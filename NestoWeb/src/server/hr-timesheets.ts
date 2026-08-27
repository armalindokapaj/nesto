import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { assertTenant } from "@/lib/tenant";

// PRD_HR_Dashboard — Timesheets + Project Labour. Timesheets bridge
// Workforce (hours actually worked) to Payroll/Finance (hours paid) without
// ever treating Work Progress module reporting as proof of payable time —
// every hour here is entered and verified independently.

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift Sunday to previous Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function logHrActivity(input: { tenantId: string; entityType: string; entityId: string; actorId?: string | null; eventType: string; summary: string }) {
  await db.hrActivity.create({
    data: { tenantId: input.tenantId, entityType: input.entityType, entityId: input.entityId, actorId: input.actorId ?? null, eventType: input.eventType, summary: input.summary },
  });
}

export async function listTimesheets(tenantId: string, filter?: { status?: string | string[]; employmentId?: string }) {
  return db.timesheet.findMany({
    where: {
      tenantId,
      employmentId: filter?.employmentId,
      ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}),
    },
    orderBy: { weekStartDate: "desc" },
    include: {
      employment: { include: { employee: { select: { id: true, fullName: true, avatarColor: true } } } },
      verifiedBy: { select: { id: true, displayName: true } },
      lines: { select: { id: true, hours: true, projectId: true } },
    },
  });
}

export async function getTimesheetDetail(tenantId: string, id: string) {
  return assertTenant(
    await db.timesheet.findUnique({
      where: { id },
      include: {
        employment: { include: { employee: { select: { id: true, fullName: true, avatarColor: true } } } },
        verifiedBy: { select: { id: true, displayName: true } },
        lines: { include: { project: { select: { id: true, name: true } } }, orderBy: { date: "asc" } },
      },
    }),
    tenantId,
    "Timesheet"
  );
}

export async function getOrCreateTimesheet(tenantId: string, employmentId: string, weekStart: Date) {
  const weekStartDate = mondayOf(weekStart);
  const existing = await db.timesheet.findUnique({ where: { employmentId_weekStartDate: { employmentId, weekStartDate } } });
  if (existing) return existing;
  return db.timesheet.create({ data: { tenantId, employmentId, weekStartDate } });
}

export async function saveTimesheetLines(
  tenantId: string,
  actorId: string,
  input: { timesheetId: string; lines: { date: Date; projectId?: string; taskId?: string; costCode?: string; hours: number; description?: string }[] }
) {
  const timesheet = assertTenant(await db.timesheet.findUnique({ where: { id: input.timesheetId } }), tenantId, "Timesheet");
  if (timesheet.status !== "DRAFT" && timesheet.status !== "REJECTED") throw new Error("Only a draft or rejected timesheet can be edited.");

  const totalHours = input.lines.reduce((sum, l) => sum + l.hours, 0);
  await db.$transaction(async (tx) => {
    await tx.timesheetLine.deleteMany({ where: { timesheetId: input.timesheetId } });
    if (input.lines.length > 0) {
      await tx.timesheetLine.createMany({
        data: input.lines.map((l) => ({
          tenantId,
          timesheetId: input.timesheetId,
          date: l.date,
          projectId: l.projectId || null,
          taskId: l.taskId || null,
          costCode: l.costCode,
          hours: l.hours,
          description: l.description,
        })),
      });
    }
    await tx.timesheet.update({ where: { id: input.timesheetId }, data: { totalHours, status: "DRAFT" } });
  });
  await logHrActivity({ tenantId, entityType: "Timesheet", entityId: input.timesheetId, actorId, eventType: "UPDATED", summary: `Timesheet lines saved (${totalHours}h)` });
}

export async function submitTimesheet(tenantId: string, actorId: string, id: string) {
  const timesheet = assertTenant(await db.timesheet.findUnique({ where: { id }, include: { lines: true } }), tenantId, "Timesheet");
  if (timesheet.status !== "DRAFT" && timesheet.status !== "REJECTED") throw new Error("Only a draft or rejected timesheet can be submitted.");
  if (timesheet.lines.length === 0) throw new Error("Add at least one hour entry before submitting.");
  const updated = await db.timesheet.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date(), rejectionReason: null } });
  await logHrActivity({ tenantId, entityType: "Timesheet", entityId: id, actorId, eventType: "SUBMITTED", summary: "Timesheet submitted for verification" });
  return updated;
}

export async function verifyTimesheet(tenantId: string, actorId: string, id: string) {
  const timesheet = assertTenant(await db.timesheet.findUnique({ where: { id } }), tenantId, "Timesheet");
  if (timesheet.status !== "SUBMITTED") throw new Error("Only a submitted timesheet can be verified.");
  const updated = await db.timesheet.update({ where: { id }, data: { status: "VERIFIED", verifiedById: actorId, verifiedAt: new Date() } });
  await logHrActivity({ tenantId, entityType: "Timesheet", entityId: id, actorId, eventType: "VERIFIED", summary: "Timesheet verified" });
  // Phase 1 Track B — a VERIFIED timesheet is the only thing Payroll treats as
  // payable hours, so this is a payroll-affecting approval with no trail.
  await logAudit({ tenantId, actorId, action: "hr.timesheet.verified", targetType: "Timesheet", targetId: id,
    metadata: { employmentId: timesheet.employmentId, weekStartDate: timesheet.weekStartDate } });
  return updated;
}

export async function rejectTimesheet(tenantId: string, actorId: string, id: string, reason: string) {
  const timesheet = assertTenant(await db.timesheet.findUnique({ where: { id } }), tenantId, "Timesheet");
  if (timesheet.status !== "SUBMITTED") throw new Error("Only a submitted timesheet can be rejected.");
  if (!reason.trim()) throw new Error("A rejection reason is required.");
  const updated = await db.timesheet.update({ where: { id }, data: { status: "REJECTED", rejectionReason: reason.trim() } });
  await logHrActivity({ tenantId, entityType: "Timesheet", entityId: id, actorId, eventType: "REJECTED", summary: `Rejected: ${reason.trim()}` });
  return updated;
}

/** §Payroll & Rewards — a VERIFIED (never SUBMITTED/DRAFT) timesheet is the
 * only source Payroll may treat as payable hours; a LOCKED PayrollRun should
 * lock its period's timesheets too, but that link is left for a later phase
 * since PayrollRunLine doesn't carry a period range to match against yet. */
export async function listVerifiedHoursForPeriod(tenantId: string, employmentId: string, from: Date, to: Date) {
  const timesheets = await db.timesheet.findMany({
    where: { tenantId, employmentId, status: { in: ["VERIFIED", "LOCKED"] }, weekStartDate: { gte: from, lte: to } },
  });
  return timesheets.reduce((sum, t) => sum + t.totalHours, 0);
}

// ---------------------------------------------------------------------------
// Project Labour — Hours / Allocation / Capacity, aggregated from verified
// TimesheetLines. Deliberately never derives payable time from Work Progress
// module reporting (physical % complete), only from these entered hours.
// ---------------------------------------------------------------------------

export async function getProjectLabour(tenantId: string, from: Date, to: Date) {
  const lines = await db.timesheetLine.findMany({
    where: { tenantId, date: { gte: from, lte: to }, projectId: { not: null }, timesheet: { status: { in: ["VERIFIED", "LOCKED"] } } },
    include: { project: { select: { id: true, name: true } } },
  });

  const byProject = new Map<string, { projectId: string; projectName: string; hours: number }>();
  for (const line of lines) {
    if (!line.projectId) continue;
    const key = line.projectId;
    const existing = byProject.get(key) ?? { projectId: key, projectName: line.project?.name ?? "—", hours: 0 };
    existing.hours += line.hours;
    byProject.set(key, existing);
  }

  const activeEmployments = await db.employmentRelationship.count({ where: { tenantId, status: "ACTIVE" } });
  // Standard capacity model: 8h/weekday per active employment across the
  // requested window — a simplification (no per-employee working-pattern
  // model exists yet), documented rather than presented as precise.
  const weekdays = countWeekdays(from, to);
  const totalCapacityHours = activeEmployments * weekdays * 8;
  const allocatedHours = Array.from(byProject.values()).reduce((sum, p) => sum + p.hours, 0);

  return {
    byProject: Array.from(byProject.values()).sort((a, b) => b.hours - a.hours),
    totalCapacityHours,
    allocatedHours,
    utilizationPct: totalCapacityHours > 0 ? Math.round((allocatedHours / totalCapacityHours) * 100) : 0,
  };
}

function countWeekdays(from: Date, to: Date) {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function getMyPendingTimesheetInbox(tenantId: string) {
  return db.timesheet.findMany({
    where: { tenantId, status: "SUBMITTED" },
    include: { employment: { include: { employee: { select: { id: true, fullName: true } } } } },
    orderBy: { submittedAt: "asc" },
    take: 20,
  });
}
