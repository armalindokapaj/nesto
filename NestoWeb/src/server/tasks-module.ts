import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { runAtMostEvery, invalidateJob } from "@/lib/read-path-jobs";

// PRD_Tasks_Module — additive layer on top of the existing Task model
// (src/server/projects.ts, src/server/task-orchestration.ts). Participant
// visibility, comments and the activity timeline already exist (PRD_10's
// canViewTask, the generic Comment model, TaskEvent); this file adds only
// what didn't: a private Star (§14) and the shared Checklist (§9).

async function logTaskEvent(input: {
  tenantId: string;
  taskId: string;
  actorId?: string | null;
  eventType: string;
  summary: string;
  previousState?: string | null;
  newState?: string | null;
}) {
  await db.taskEvent.create({
    data: {
      tenantId: input.tenantId,
      taskId: input.taskId,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
    },
  });
}

/** §14 — private per-user toggle. Never changes official priority or status. */
export async function toggleTaskStar(tenantId: string, taskId: string, userId: string) {
  assertTenant(await db.task.findUnique({ where: { id: taskId } }), tenantId, "Task");
  const existing = await db.taskStar.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (existing) {
    await db.taskStar.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await db.taskStar.create({ data: { tenantId, taskId, userId } });
  return { starred: true };
}

/** The current user's starred task ids — for highlighting rows on the module page. */
export async function listStarredTaskIds(tenantId: string, userId: string) {
  const stars = await db.taskStar.findMany({ where: { tenantId, userId }, select: { taskId: true } });
  return new Set(stars.map((s) => s.taskId));
}

export async function isTaskStarred(tenantId: string, taskId: string, userId: string) {
  return (await db.taskStar.findUnique({ where: { taskId_userId: { taskId, userId } } }))?.tenantId === tenantId;
}

/** §9 — the shared checklist, oldest first so ordering is stable as items complete. */
export async function listChecklistItems(tenantId: string, taskId: string) {
  return db.taskChecklistItem.findMany({
    where: { tenantId, taskId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      owner: { select: { id: true, displayName: true, avatarColor: true } },
      completedBy: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function addChecklistItem(
  tenantId: string,
  input: { taskId: string; title: string; ownerId?: string | null; dueAt?: Date | null; createdById: string }
) {
  const title = input.title.trim();
  if (!title) throw new Error("Checklist item needs a title.");
  assertTenant(await db.task.findUnique({ where: { id: input.taskId } }), tenantId, "Task");

  const count = await db.taskChecklistItem.count({ where: { tenantId, taskId: input.taskId } });
  const item = await db.taskChecklistItem.create({
    data: {
      tenantId,
      taskId: input.taskId,
      title,
      ownerId: input.ownerId ?? null,
      dueAt: input.dueAt ?? null,
      createdById: input.createdById,
      sortOrder: count,
    },
  });
  await logTaskEvent({
    tenantId,
    taskId: input.taskId,
    actorId: input.createdById,
    eventType: "CHECKLIST_ITEM_ADDED",
    summary: `Checklist item added: ${title}`,
  });
  return item;
}

/** Any participant may check/uncheck — every flip is written to the timeline (§9). */
export async function toggleChecklistItem(tenantId: string, itemId: string, actorId: string) {
  const item = assertTenant(await db.taskChecklistItem.findUnique({ where: { id: itemId } }), tenantId, "TaskChecklistItem");
  const completed = !item.completed;

  const updated = await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedById: completed ? actorId : null,
      completedAt: completed ? new Date() : null,
    },
  });
  await logTaskEvent({
    tenantId,
    taskId: item.taskId,
    actorId,
    eventType: completed ? "CHECKLIST_ITEM_COMPLETED" : "CHECKLIST_ITEM_REOPENED",
    summary: `${completed ? "Completed" : "Reopened"} checklist item: ${item.title}`,
  });
  return updated;
}

export async function deleteChecklistItem(tenantId: string, itemId: string, actorId: string) {
  const item = assertTenant(await db.taskChecklistItem.findUnique({ where: { id: itemId } }), tenantId, "TaskChecklistItem");
  await db.taskChecklistItem.delete({ where: { id: itemId } });
  await logTaskEvent({
    tenantId,
    taskId: item.taskId,
    actorId,
    eventType: "CHECKLIST_ITEM_REMOVED",
    summary: `Removed checklist item: ${item.title}`,
  });
}

// ---------------------------------------------------------------------------
// Watching — private, never widens access. A watcher who loses task
// visibility (participant removed) simply stops seeing the task at all,
// same as anyone else; the watch row itself isn't cleaned up specially
// since it grants nothing on its own.
// ---------------------------------------------------------------------------

export async function toggleTaskWatch(tenantId: string, taskId: string, userId: string) {
  assertTenant(await db.task.findUnique({ where: { id: taskId } }), tenantId, "Task");
  const existing = await db.taskWatcher.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (existing) {
    await db.taskWatcher.delete({ where: { id: existing.id } });
    return { watching: false };
  }
  await db.taskWatcher.create({ data: { tenantId, taskId, userId } });
  return { watching: true };
}

export async function listWatchedTaskIds(tenantId: string, userId: string) {
  const rows = await db.taskWatcher.findMany({ where: { tenantId, userId }, select: { taskId: true } });
  return new Set(rows.map((r) => r.taskId));
}

export async function isTaskWatched(tenantId: string, taskId: string, userId: string) {
  return (await db.taskWatcher.findUnique({ where: { taskId_userId: { taskId, userId } } }))?.tenantId === tenantId;
}

/** No direct UserIdentity relation on TaskWatcher — callers resolve display names via listTenantUsersForPicker if needed. */
export async function listTaskWatchers(tenantId: string, taskId: string) {
  return db.taskWatcher.findMany({ where: { tenantId, taskId } });
}

// ---------------------------------------------------------------------------
// Generic cross-entity links — mirrors DocumentLink's shape/pattern.
// ---------------------------------------------------------------------------

export async function listTaskLinks(tenantId: string, taskId: string) {
  return db.taskLink.findMany({ where: { tenantId, taskId }, orderBy: { createdAt: "desc" } });
}

export async function addTaskLink(tenantId: string, actorId: string, taskId: string, entityType: string, entityId: string, relationType?: string) {
  assertTenant(await db.task.findUnique({ where: { id: taskId } }), tenantId, "Task");
  return db.taskLink.create({ data: { tenantId, taskId, entityType, entityId, relationType, createdById: actorId } });
}

export async function removeTaskLink(tenantId: string, linkId: string) {
  const link = assertTenant(await db.taskLink.findUnique({ where: { id: linkId } }), tenantId, "TaskLink");
  await db.taskLink.delete({ where: { id: link.id } });
}

// ---------------------------------------------------------------------------
// Recurrence — lazy generation, no background scheduler. `dueDueOccurrences`
// is called from the task list page load; any run whose nextRunAt has
// passed generates its next Task occurrence and advances the schedule, so a
// tenant that hasn't opened the app for a week still catches up correctly
// (each catch-up only ever creates one occurrence — it advances to "next run
// after now", not one row per missed period).
// ---------------------------------------------------------------------------

function advanceDate(from: Date, frequency: string, interval: number): Date {
  const next = new Date(from);
  if (frequency === "DAILY") next.setDate(next.getDate() + interval);
  else if (frequency === "WEEKLY") next.setDate(next.getDate() + interval * 7);
  else next.setMonth(next.getMonth() + interval);
  return next;
}

export async function setTaskRecurrence(
  tenantId: string,
  actorId: string,
  taskId: string,
  input: { frequency: string; interval: number }
) {
  const task = assertTenant(await db.task.findUnique({ where: { id: taskId } }), tenantId, "Task");
  const nextRunAt = advanceDate(task.dueDate ?? new Date(), input.frequency, input.interval);
  const saved = await db.taskRecurrence.upsert({
    where: { templateTaskId: taskId },
    create: { tenantId, templateTaskId: taskId, frequency: input.frequency, interval: input.interval, nextRunAt, createdById: actorId },
    update: { frequency: input.frequency, interval: input.interval, active: true },
  });
  invalidateRecurrenceSchedule(tenantId);
  return saved;
}

export async function getTaskRecurrence(tenantId: string, taskId: string) {
  const rec = await db.taskRecurrence.findUnique({ where: { templateTaskId: taskId } });
  return rec && rec.tenantId === tenantId ? rec : null;
}

export async function stopTaskRecurrence(tenantId: string, recurrenceId: string) {
  const rec = assertTenant(await db.taskRecurrence.findUnique({ where: { id: recurrenceId } }), tenantId, "TaskRecurrence");
  const stopped = await db.taskRecurrence.update({ where: { id: rec.id }, data: { active: false } });
  invalidateRecurrenceSchedule(tenantId);
  return stopped;
}

/**
 * The /tasks pre-pass: generate any recurring tasks that have come due.
 *
 * The page awaited processDueRecurrences directly, and could not start
 * loading tasks until it answered — a serial ~125ms round trip on every
 * render to ask a question whose answer is "nothing is due" almost always.
 *
 * At most once a minute per tenant. Recurrences are daily at their most
 * frequent, so a generated task can be up to a minute late to appear;
 * creating or editing a recurrence clears the window (see
 * invalidateRecurrenceSchedule) so a user never watches their own change
 * fail to take effect.
 */
export async function processDueRecurrencesOnView(tenantId: string) {
  await runAtMostEvery(recurrenceJobKey(tenantId), 60_000, () => processDueRecurrences(tenantId));
}

function recurrenceJobKey(tenantId: string) {
  return `tasks:recurrences:${tenantId}`;
}

/** Lets the next /tasks render run the recurrence pass immediately. */
export function invalidateRecurrenceSchedule(tenantId: string) {
  invalidateJob(recurrenceJobKey(tenantId));
}

/** Generates every recurrence whose next run is due. Read paths should go
 *  through processDueRecurrencesOnView rather than calling this directly. */
export async function processDueRecurrences(tenantId: string) {
  const due = await db.taskRecurrence.findMany({
    where: { tenantId, active: true, nextRunAt: { lte: new Date() } },
    include: { templateTask: true },
  });
  for (const rec of due) {
    const t = rec.templateTask;
    const created = await db.task.create({
      data: {
        tenantId,
        projectId: t.projectId,
        clientId: t.clientId,
        code: `${t.code}-R${Date.now().toString(36).toUpperCase()}`,
        title: t.title,
        description: t.description,
        visibility: t.visibility,
        priority: t.priority,
        dueDate: rec.nextRunAt,
        createdById: rec.createdById,
        mainResponsibleId: t.mainResponsibleId,
        departmentRole: t.departmentRole,
      },
    });
    await db.taskRecurrence.update({
      where: { id: rec.id },
      data: { nextRunAt: advanceDate(rec.nextRunAt, rec.frequency, rec.interval), lastGeneratedAt: new Date(), lastGeneratedTaskId: created.id },
    });
  }
  return due.length;
}

// ---------------------------------------------------------------------------
// Saved views — per-user, server-persisted (the layout picker was
// URL-only before this).
// ---------------------------------------------------------------------------

export async function listSavedViews(tenantId: string, userId: string) {
  return db.taskSavedView.findMany({ where: { tenantId, userId }, orderBy: { createdAt: "desc" } });
}

export async function createSavedView(tenantId: string, userId: string, input: { name: string; layout: string; filtersJson?: string; isDefault?: boolean }) {
  if (input.isDefault) await db.taskSavedView.updateMany({ where: { tenantId, userId }, data: { isDefault: false } });
  return db.taskSavedView.create({ data: { tenantId, userId, ...input } });
}

export async function deleteSavedView(tenantId: string, viewId: string) {
  const view = assertTenant(await db.taskSavedView.findUnique({ where: { id: viewId } }), tenantId, "TaskSavedView");
  await db.taskSavedView.delete({ where: { id: view.id } });
}
