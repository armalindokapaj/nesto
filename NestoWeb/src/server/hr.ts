import { db } from "@/lib/db";

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
