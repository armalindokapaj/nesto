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
