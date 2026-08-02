import { db } from "@/lib/db";

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getMonthCalendarData(tenantId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);

  const [leaveEntries, appointments] = await Promise.all([
    db.leaveRequest.findMany({
      where: { tenantId, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
      include: { employee: true },
    }),
    db.hrAppointment.findMany({
      where: { tenantId, scheduledAt: { gte: start, lte: end } },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return { leaveEntries, appointments };
}

// Leave overlapping the Mon–Sun week that contains `today` — independent of
// whichever month the calendar grid is currently navigated to, so "who's off
// this week" stays answerable even mid-month-view-scroll.
export async function getCurrentWeekLeave(tenantId: string) {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const leaveEntries = await db.leaveRequest.findMany({
    where: { tenantId, status: "APPROVED", startDate: { lte: weekEnd }, endDate: { gte: weekStart } },
    include: { employee: true },
    orderBy: { startDate: "asc" },
  });

  return { weekStart, weekEnd, leaveEntries };
}

export async function createHrAppointment(
  tenantId: string,
  createdById: string,
  input: { title: string; type: string; scheduledAt: Date; candidateName?: string; notes?: string }
) {
  const appointment = await db.hrAppointment.create({ data: { tenantId, createdById, ...input } });

  const hrMembers = await db.companyMembership.findMany({ where: { tenantId, role: "HR" }, select: { userId: true } });
  if (hrMembers.length > 0) {
    await db.notification.createMany({
      data: hrMembers.map((m) => ({
        tenantId,
        userId: m.userId,
        type: "HR_APPOINTMENT_SCHEDULED",
        title: input.type === "INTERVIEW" ? "Interview scheduled" : "Appointment scheduled",
        body: input.candidateName ? `${input.title} — ${input.candidateName}` : input.title,
        link: "/dashboard/hr/calendar",
      })),
    });
  }

  return appointment;
}
