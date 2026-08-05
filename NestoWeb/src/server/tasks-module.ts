import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

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
