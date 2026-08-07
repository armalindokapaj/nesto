import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";

export async function getHrDashboardData(tenantId: string) {
  const [employees, leaveRequests] = await Promise.all([
    db.employee.findMany({ where: { tenantId }, orderBy: { hireDate: "desc" } }),
    db.leaveRequest.findMany({
      where: { tenantId },
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const newHires = employees.filter((e) => e.hireDate >= thirtyDaysAgo);
  // "On leave" is derived from approved requests covering today, not a static
  // employee.status flag — a flag would drift out of sync the moment a leave
  // request is approved or a leave period ends.
  const onLeaveToday = leaveRequests.filter(
    (l) => l.status === "APPROVED" && l.startDate <= now && l.endDate >= now
  );
  const pendingLeave = leaveRequests.filter((l) => l.status === "PENDING");

  const distribution = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1;
    return acc;
  }, {});

  const upcomingBirthdays = employees
    .filter((e) => e.birthday)
    .map((e) => {
      const bday = new Date(e.birthday!);
      const next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      return { employee: e, next };
    })
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 4);

  return {
    totalEmployees: employees.length,
    newHiresCount: newHires.length,
    onLeaveCount: onLeaveToday.length,
    openPositions: 0, // Recruitment pipeline (job postings) is Phase 2 — no fabricated count
    recentHires: employees.slice(0, 5),
    leaveRequests: leaveRequests.slice(0, 5),
    pendingLeaveCount: pendingLeave.length,
    distribution: Object.entries(distribution).map(([label, value]) => ({ label, value })),
    upcomingBirthdays,
  };
}

export async function listEmployees(tenantId: string) {
  return db.employee.findMany({ where: { tenantId }, orderBy: { fullName: "asc" } });
}

export async function listLeaveRequests(tenantId: string) {
  return db.leaveRequest.findMany({
    where: { tenantId },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
}

// PRD_9 LEV-001 — the employee themselves, their direct superior, or an
// HR-permission holder may create a request; all three paths land here.
export async function createLeaveRequest(
  tenantId: string,
  employeeId: string,
  createdById: string,
  input: { startDate: Date; endDate: Date; reason?: string }
) {
  return db.leaveRequest.create({ data: { tenantId, employeeId, createdById, ...input } });
}

// PRD_9 LEV-002 — only reachable from an HR-FULL-gated action.
export async function decideLeaveRequest(
  tenantId: string,
  decidedById: string,
  leaveRequestId: string,
  decision: "APPROVED" | "REJECTED"
) {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  return db.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: decision, decidedById } });
}

// PRD_9 LEV-003 — "only HR shall be able to change or cancel an approved
// leave entry"; both functions require the entry to already be APPROVED.
export async function cancelApprovedLeave(tenantId: string, decidedById: string, leaveRequestId: string) {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  if (leave.status !== "APPROVED") throw new Error("Only an approved leave entry can be cancelled.");
  return db.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: "CANCELLED", decidedById } });
}

// ---------------------------------------------------------------------------
// PRD_HR_Payroll_Workforce — Phase 1 (EmploymentRelationship). "HR governs
// employment" as an effective-dated timeline, separate from the Employee
// row's plain position/department strings and from Payroll (not built —
// Phase 3 in the PRD's own sequencing). See prd_hr_payroll_workforce_module
// memory for the full spec; this is deliberately just the foundation.
// ---------------------------------------------------------------------------

export async function getEmploymentRelationships(tenantId: string, employeeId: string) {
  return db.employmentRelationship.findMany({
    where: { tenantId, employeeId },
    include: { reportsTo: true, company: true, createdBy: true, transferredFrom: true },
    orderBy: { effectiveStartDate: "desc" },
  });
}

// Employment changes never edit a live row — they close the current ACTIVE
// one (if any) and open a new one, linked via transferredFromId when the
// PRD's "intercompany transfer" flag is set ("creates a NEW employment
// relationship rather than mutating the old one"). This is the PRD's
// "changes create new dated records, never overwrite" rule for employment.
export async function recordEmploymentChange(
  tenantId: string,
  employeeId: string,
  createdById: string,
  input: {
    employmentType: string;
    contractType: string;
    jobTitle: string;
    department: string;
    reportsToId?: string;
    companyId?: string;
    effectiveStartDate: Date;
    confidentialityZone?: string;
    notes?: string;
    isTransfer?: boolean;
  }
) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.tenantId !== tenantId) throw new Error("Employee not found.");

  return db.$transaction(async (tx) => {
    const current = await tx.employmentRelationship.findFirst({
      where: { tenantId, employeeId, status: "ACTIVE" },
      orderBy: { effectiveStartDate: "desc" },
    });

    let transferredFromId: string | undefined;
    if (current) {
      await tx.employmentRelationship.update({
        where: { id: current.id },
        data: {
          status: input.isTransfer ? "TRANSFERRED" : "SUSPENDED",
          effectiveEndDate: input.effectiveStartDate,
        },
      });
      if (input.isTransfer) transferredFromId = current.id;
    }

    const created = await tx.employmentRelationship.create({
      data: {
        tenantId,
        employeeId,
        companyId: input.companyId,
        employmentType: input.employmentType,
        contractType: input.contractType,
        jobTitle: input.jobTitle,
        department: input.department,
        reportsToId: input.reportsToId,
        effectiveStartDate: input.effectiveStartDate,
        confidentialityZone: input.confidentialityZone ?? "INTERNAL_PROFESSIONAL",
        notes: input.notes,
        transferredFromId,
        createdById,
      },
    });

    await tx.hrActivity.create({
      data: {
        tenantId,
        entityType: "EmploymentRelationship",
        entityId: created.id,
        actorId: createdById,
        eventType: input.isTransfer ? "TRANSFERRED" : current ? "UPDATED" : "HIRED",
        summary: `${employee.fullName} — ${input.jobTitle} (${input.department})${input.isTransfer ? ", transferred" : ""}`,
      },
    });

    return created;
  });
}

// Salary reuses the existing HR/FULL-or-FINANCE/FULL gate from
// employee-profile.ts (canViewSalary) — Payroll confidentiality zones are
// permission-ready (EmploymentRelationship.confidentialityZone) but this is
// the only gate actually enforced in Phase 1.
export async function getEmployeeHrDetail(tenantId: string, employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      manager: true,
      trainings: { orderBy: { createdAt: "desc" } },
      leaveRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      salaryRecords: { orderBy: { effectiveStartDate: "desc" } },
    },
  });
  if (!employee || employee.tenantId !== tenantId) return null;

  const employmentRelationships = await getEmploymentRelationships(tenantId, employeeId);

  const activity = employmentRelationships.length
    ? await db.hrActivity.findMany({
        where: { tenantId, entityId: { in: employmentRelationships.map((r) => r.id) } },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return { employee, employmentRelationships, activity };
}

export async function listReportableEmployees(tenantId: string) {
  return db.employee.findMany({ where: { tenantId }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, position: true } });
}

export function canManageEmployment(role: Role) {
  return can(role, "HR", "FULL");
}

// PRD_HR_Dashboard §Offboarding — closes the current ACTIVE employment with
// status TERMINATED, same "close, never mutate in place" rule
// recordEmploymentChange follows above; unlike a transfer, this opens no
// replacement relationship.
export async function terminateEmployment(tenantId: string, actorId: string, employmentId: string, effectiveEndDate: Date, notes?: string) {
  const employment = await db.employmentRelationship.findUnique({ where: { id: employmentId }, include: { employee: true } });
  if (!employment || employment.tenantId !== tenantId) throw new Error("Employment relationship not found.");
  if (employment.status !== "ACTIVE") throw new Error("Only an active employment can be terminated.");

  const updated = await db.employmentRelationship.update({
    where: { id: employmentId },
    data: { status: "TERMINATED", effectiveEndDate, notes: notes ? `${employment.notes ? employment.notes + " " : ""}${notes}` : employment.notes },
  });
  await db.hrActivity.create({
    data: { tenantId, entityType: "EmploymentRelationship", entityId: employmentId, actorId, eventType: "TERMINATED", summary: `${employment.employee.fullName} — employment terminated` },
  });
  return updated;
}

export async function listExternalWorkforce(tenantId: string) {
  return db.employmentRelationship.findMany({
    where: { tenantId, employmentType: { in: ["CONTRACTOR", "EXTERNAL"] }, status: "ACTIVE" },
    include: { employee: { select: { id: true, fullName: true } }, company: { select: { id: true, name: true } } },
    orderBy: { effectiveStartDate: "desc" },
  });
}

export async function updateApprovedLeave(
  tenantId: string,
  decidedById: string,
  leaveRequestId: string,
  input: { startDate: Date; endDate: Date; reason?: string }
) {
  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) throw new Error("Leave request not found.");
  if (leave.status !== "APPROVED") throw new Error("Only an approved leave entry can be edited.");
  return db.leaveRequest.update({ where: { id: leaveRequestId }, data: { ...input, decidedById } });
}
