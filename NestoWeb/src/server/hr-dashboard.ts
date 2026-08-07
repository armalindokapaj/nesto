import "server-only";
import { db } from "@/lib/db";
import { getProjectLabour, getMyPendingTimesheetInbox } from "@/server/hr-timesheets";

// PRD_HR_Dashboard — the 11-region dashboard aggregator: Employees, Workforce
// Today, Recruitment, Attendance, Timesheets, Leave & Absence, Payroll
// (independently permission-gated by the caller, still computed here),
// Training & Competence, Project Labour, Work Inbox, Recent Activity.

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHrDashboard(tenantId: string) {
  const today = startOfToday();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [
    employees,
    activeEmployments,
    onLeaveToday,
    pendingLeave,
    openVacancies,
    activeCandidates,
    todayAttendance,
    pendingTimesheets,
    payrollRunsOpen,
    trainingExpiringSoon,
    projectLabour,
    workInboxTimesheets,
    pendingOffers,
    recentHrActivity,
    recentPayrollActivity,
  ] = await Promise.all([
    db.employee.findMany({ where: { tenantId }, orderBy: { hireDate: "desc" } }),
    db.employmentRelationship.count({ where: { tenantId, status: "ACTIVE" } }),
    db.leaveRequest.findMany({ where: { tenantId, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } }, include: { employee: { select: { id: true, fullName: true } } } }),
    db.leaveRequest.count({ where: { tenantId, status: "PENDING" } }),
    db.vacancy.count({ where: { tenantId, status: "OPEN" } }),
    db.candidate.count({ where: { tenantId, stage: { notIn: ["REJECTED", "HIRED"] } } }),
    db.attendanceEvent.findMany({ where: { tenantId, occurredAt: { gte: today } } }),
    db.timesheet.count({ where: { tenantId, status: "SUBMITTED" } }),
    db.payrollRun.count({ where: { tenantId, status: { in: ["DRAFT", "CALCULATED"] } } }),
    db.employeeTraining.findMany({ where: { tenantId, expiryDate: { not: null, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) } }, include: { employee: { select: { id: true, fullName: true } } }, take: 8 }),
    getProjectLabour(tenantId, monthStart, monthEnd),
    getMyPendingTimesheetInbox(tenantId),
    db.offer.count({ where: { tenantId, status: "SENT" } }),
    db.hrActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { id: true, displayName: true } } } }),
    db.payrollActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 4, include: { actor: { select: { id: true, displayName: true } } } }),
  ]);

  const clockedInIds = new Set(
    todayAttendance.filter((e) => e.type === "CLOCK_IN").map((e) => e.employeeId)
  );
  const clockedOutIds = new Set(todayAttendance.filter((e) => e.type === "CLOCK_OUT").map((e) => e.employeeId));
  const presentNow = Array.from(clockedInIds).filter((id) => !clockedOutIds.has(id)).length;

  const newHires = employees.filter((e) => e.hireDate >= thirtyDaysAgo);

  const recentActivity = [...recentHrActivity, ...recentPayrollActivity]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return {
    employees: { total: employees.length, active: activeEmployments, newHires: newHires.length, recent: employees.slice(0, 5) },
    workforceToday: { presentNow, onLeave: onLeaveToday.length, onLeaveList: onLeaveToday },
    recruitment: { openVacancies, activeCandidates, pendingOffers },
    attendance: { eventsToday: todayAttendance.length, presentNow },
    timesheets: { pendingVerification: pendingTimesheets, inbox: workInboxTimesheets },
    leave: { pendingCount: pendingLeave, onLeaveToday: onLeaveToday.length },
    payroll: { runsInProgress: payrollRunsOpen },
    training: { expiringSoon: trainingExpiringSoon },
    projectLabour,
    workInbox: workInboxTimesheets,
    recentActivity,
  };
}
