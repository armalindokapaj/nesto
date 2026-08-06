import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_HR_Payroll_Workforce — Attendance & Scheduling. See the schema comment
// above ShiftDefinition for the scope decision (no Timesheet/project labour
// cost here — that belongs to Work Progress).

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function listShiftDefinitions(tenantId: string) {
  return db.shiftDefinition.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createShiftDefinition(
  tenantId: string,
  actorId: string,
  input: { name: string; startTime: string; endTime: string; daysOfWeek: string[] }
) {
  return db.shiftDefinition.create({
    data: { tenantId, createdById: actorId, name: input.name, startTime: input.startTime, endTime: input.endTime, daysOfWeek: input.daysOfWeek.join(",") },
  });
}

// ---------------------------------------------------------------------------
// Schedule assignments — effective-dated, same "close current, open new"
// discipline as EmploymentRelationship.
// ---------------------------------------------------------------------------

export async function listScheduleAssignments(tenantId: string) {
  return db.scheduleAssignment.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: { employee: { select: { id: true, fullName: true } }, shiftDefinition: true },
    orderBy: { employee: { fullName: "asc" } },
  });
}

export async function assignSchedule(tenantId: string, actorId: string, employeeId: string, shiftDefinitionId: string) {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  const shift = assertTenant(await db.shiftDefinition.findUnique({ where: { id: shiftDefinitionId } }), tenantId, "ShiftDefinition");

  return db.$transaction(async (tx) => {
    await tx.scheduleAssignment.updateMany({
      where: { tenantId, employeeId: employee.id, status: "ACTIVE" },
      data: { status: "ENDED", effectiveEndDate: new Date() },
    });
    return tx.scheduleAssignment.create({
      data: { tenantId, employeeId: employee.id, shiftDefinitionId: shift.id, effectiveStartDate: new Date(), assignedById: actorId },
    });
  });
}

export async function endScheduleAssignment(tenantId: string, assignmentId: string) {
  const assignment = assertTenant(await db.scheduleAssignment.findUnique({ where: { id: assignmentId } }), tenantId, "ScheduleAssignment");
  return db.scheduleAssignment.update({ where: { id: assignment.id }, data: { status: "ENDED", effectiveEndDate: new Date() } });
}

// ---------------------------------------------------------------------------
// Attendance — immutable event ledger; daily status is derived at read time.
// ---------------------------------------------------------------------------

export async function getEmployeeByUserId(tenantId: string, userId: string) {
  return db.employee.findFirst({ where: { tenantId, userId } });
}

/** The employee's own most recent event today, to drive the clock-in/out button state. */
export async function getTodayClockState(tenantId: string, employeeId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const last = await db.attendanceEvent.findFirst({
    where: { tenantId, employeeId, occurredAt: { gte: startOfDay } },
    orderBy: { occurredAt: "desc" },
  });
  return { clockedIn: last?.type === "CLOCK_IN", lastEvent: last };
}

export async function recordAttendanceEvent(tenantId: string, actorId: string, employeeId: string, type: "CLOCK_IN" | "CLOCK_OUT") {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  const { clockedIn } = await getTodayClockState(tenantId, employee.id);
  if (type === "CLOCK_IN" && clockedIn) throw new Error("Already clocked in today.");
  if (type === "CLOCK_OUT" && !clockedIn) throw new Error("Not currently clocked in.");
  return db.attendanceEvent.create({ data: { tenantId, employeeId: employee.id, type, recordedById: actorId } });
}

/** Derived per-employee daily summary for a date range — worked minutes from paired CLOCK_IN/CLOCK_OUT events. */
export async function listAttendanceSummary(tenantId: string, from: Date, to: Date) {
  const events = await db.attendanceEvent.findMany({
    where: { tenantId, occurredAt: { gte: from, lte: to } },
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: { occurredAt: "asc" },
  });

  const byEmployeeDay = new Map<string, { employeeId: string; employeeName: string; date: string; events: typeof events }>();
  for (const ev of events) {
    const date = ev.occurredAt.toISOString().slice(0, 10);
    const key = `${ev.employeeId}:${date}`;
    if (!byEmployeeDay.has(key)) byEmployeeDay.set(key, { employeeId: ev.employeeId, employeeName: ev.employee.fullName, date, events: [] });
    byEmployeeDay.get(key)!.events.push(ev);
  }

  return [...byEmployeeDay.values()]
    .map((day) => {
      let workedMinutes = 0;
      let clockIn: Date | null = null;
      for (const ev of day.events) {
        if (ev.type === "CLOCK_IN") clockIn = ev.occurredAt;
        else if (ev.type === "CLOCK_OUT" && clockIn) {
          workedMinutes += Math.round((ev.occurredAt.getTime() - clockIn.getTime()) / 60000);
          clockIn = null;
        }
      }
      const status = clockIn ? "IN_PROGRESS" : workedMinutes > 0 ? "COMPLETE" : "INCOMPLETE";
      return { employeeId: day.employeeId, employeeName: day.employeeName, date: day.date, workedMinutes, status };
    })
    .sort((a, b) => (a.date === b.date ? a.employeeName.localeCompare(b.employeeName) : b.date.localeCompare(a.date)));
}
