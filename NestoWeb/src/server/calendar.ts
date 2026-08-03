import "server-only";
import { db } from "@/lib/db";
import { REMINDER_ITEM_TYPES } from "@/lib/constants";
import type { ReminderItemType, CalendarItemSource } from "@/lib/constants";

export type CalendarItem = {
  id: string;
  source: CalendarItemSource;
  sourceId: string;
  title: string;
  subtitle?: string;
  date: Date;
  href: string;
  // AGENDA-only: full record detail, so the calendar UI's inline edit dialog
  // has everything it needs to save without silently blanking out fields
  // this aggregator doesn't otherwise carry (endAt/location/notes).
  agendaDetail?: { endAt: Date | null; location: string | null; notes: string | null };
};

// PRD_9 §3.1 — one combined, read-only view over each item's own
// source-of-truth table. Nothing here is a separately synced copy, so
// completion/status changes on the original record show up automatically.
// Privacy (§3.3): every branch below is scoped to `userId` — this is the
// calendar OWNER's own items only, never a colleague's (that's the deferred
// Team Availability feature, a different view entirely).
export async function getPersonalCalendarItems(
  tenantId: string,
  userId: string,
  range: { from: Date; to: Date }
): Promise<CalendarItem[]> {
  const { from, to } = range;
  const items: CalendarItem[] = [];

  const [agendaEvents, tasks, meetings, leave, milestones, inspections] = await Promise.all([
    db.agendaEvent.findMany({ where: { tenantId, userId, startAt: { gte: from, lte: to } } }),
    db.task.findMany({
      where: { tenantId, mainResponsibleId: userId, dueDate: { gte: from, lte: to } },
      select: { id: true, title: true, code: true, dueDate: true, projectId: true },
    }),
    db.meeting.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: from, lte: to },
        OR: [{ organiserId: userId }, { project: { members: { some: { userId } } } }],
      },
    }),
    db.leaveRequest.findMany({
      where: { tenantId, status: "APPROVED", employee: { userId }, startDate: { lte: to }, endDate: { gte: from } },
    }),
    db.projectMilestone.findMany({
      where: { tenantId, dueDate: { gte: from, lte: to }, project: { members: { some: { userId } } } },
      include: { project: true },
    }),
    db.taskInspection.findMany({
      where: { tenantId, inspectorId: userId, requestedAt: { gte: from, lte: to } },
      include: { task: true },
    }),
  ]);

  for (const e of agendaEvents) {
    items.push({
      id: `agenda-${e.id}`,
      source: "AGENDA",
      sourceId: e.id,
      title: e.title,
      date: e.startAt,
      href: "/calendar",
      agendaDetail: { endAt: e.endAt, location: e.location, notes: e.notes },
    });
  }
  for (const t of tasks) {
    items.push({
      id: `task-${t.id}`,
      source: "TASK",
      sourceId: t.id,
      title: t.title,
      subtitle: t.code,
      date: t.dueDate!,
      href: t.projectId ? `/projects/${t.projectId}` : "/tasks",
    });
  }
  for (const m of meetings) {
    items.push({
      id: `meeting-${m.id}`,
      source: "MEETING",
      sourceId: m.id,
      title: m.title,
      subtitle: m.location ?? undefined,
      date: m.scheduledAt,
      href: "/meetings",
    });
  }
  for (const l of leave) {
    // §3.1 "Approved leave" row — the owner's own dates and status only.
    items.push({
      id: `leave-${l.id}`,
      source: "LEAVE",
      sourceId: l.id,
      title: "Approved leave",
      date: l.startDate,
      href: "/dashboard/hr/leave",
    });
  }
  for (const ms of milestones) {
    items.push({
      id: `milestone-${ms.id}`,
      source: "MILESTONE",
      sourceId: ms.id,
      title: ms.title,
      subtitle: ms.project.name,
      date: ms.dueDate,
      href: `/projects/${ms.projectId}`,
    });
  }
  for (const insp of inspections) {
    items.push({
      id: `inspection-${insp.id}`,
      source: "INSPECTION",
      sourceId: insp.id,
      title: insp.task.title,
      subtitle: insp.task.code,
      date: insp.requestedAt,
      href: insp.task.projectId ? `/projects/${insp.task.projectId}` : "/tasks",
    });
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function createAgendaEvent(
  tenantId: string,
  userId: string,
  input: { title: string; startAt: Date; endAt?: Date; location?: string; notes?: string }
) {
  return db.agendaEvent.create({ data: { tenantId, userId, ...input } });
}

export async function updateAgendaEvent(
  userId: string,
  id: string,
  input: { title: string; startAt: Date; endAt?: Date | null; location?: string; notes?: string }
) {
  const event = await db.agendaEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) throw new Error("Agenda event not found.");
  return db.agendaEvent.update({ where: { id }, data: input });
}

export async function deleteAgendaEvent(userId: string, id: string) {
  const event = await db.agendaEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) throw new Error("Agenda event not found.");
  await db.agendaEvent.delete({ where: { id } });
}

// §5.1 — reminder timing belongs to the user account, defaults to 30
// minutes before for every item type until the user sets their own.
export async function getReminderPreferences(userId: string): Promise<Record<ReminderItemType, number>> {
  const rows = await db.reminderPreference.findMany({ where: { userId } });
  const byType = new Map(rows.map((r) => [r.itemType, r.minutesBefore]));
  return Object.fromEntries(REMINDER_ITEM_TYPES.map((t) => [t, byType.get(t) ?? 30])) as Record<ReminderItemType, number>;
}

export async function saveReminderPreferences(userId: string, minutesByType: Record<ReminderItemType, number>) {
  await db.$transaction(
    REMINDER_ITEM_TYPES.map((itemType) =>
      db.reminderPreference.upsert({
        where: { userId_itemType: { userId, itemType } },
        create: { userId, itemType, minutesBefore: minutesByType[itemType] },
        update: { minutesBefore: minutesByType[itemType] },
      })
    )
  );
}

export async function getEmployeeForUser(tenantId: string, userId: string) {
  return db.employee.findFirst({ where: { tenantId, userId } });
}

export async function getDirectReports(tenantId: string, managerEmployeeId: string) {
  return db.employee.findMany({ where: { tenantId, managerId: managerEmployeeId }, orderBy: { fullName: "asc" } });
}
