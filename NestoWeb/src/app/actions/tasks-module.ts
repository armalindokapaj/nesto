"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  toggleTaskStar,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  toggleTaskWatch,
  addTaskLink,
  removeTaskLink,
  setTaskRecurrence,
  stopTaskRecurrence,
  createSavedView,
  deleteSavedView,
} from "@/server/tasks-module";

// PRD_Tasks_Module — additive actions (Star, Checklist). Everything else
// (create/edit/status, orchestration, comments) continues to run through the
// existing src/app/actions/*.ts entry points.

type ActionState = { error: string } | { ok: true } | undefined;

export async function toggleTaskStarAction(taskId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  // Starring is a private read-side preference — READ access is enough.
  if (!can(role, "TASKS", "READ")) throw new Error("Not authorized");
  const result = await toggleTaskStar(tenantId, taskId, user.id);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return result;
}

const AddItemSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1, "Enter a checklist item"),
  ownerId: z.string().optional(),
  dueAt: z.string().optional(),
});

export async function addChecklistItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = AddItemSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    ownerId: formData.get("ownerId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    if (!can(role, "TASKS", "WRITE")) throw new Error("Not authorized");
    await addChecklistItem(tenantId, {
      taskId: parsed.data.taskId,
      title: parsed.data.title,
      ownerId: parsed.data.ownerId ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      createdById: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add checklist item" };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function toggleChecklistItemAction(itemId: string, taskId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) throw new Error("Not authorized");
  await toggleChecklistItem(tenantId, itemId, user.id);
  revalidatePath(`/tasks/${taskId}`);
}

export async function deleteChecklistItemAction(itemId: string, taskId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) throw new Error("Not authorized");
  await deleteChecklistItem(tenantId, itemId, user.id);
  revalidatePath(`/tasks/${taskId}`);
}

export async function toggleTaskWatchAction(taskId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) throw new Error("Not authorized");
  const result = await toggleTaskWatch(tenantId, taskId, user.id);
  revalidatePath(`/tasks/${taskId}`);
  return result;
}

const AddLinkSchema = z.object({
  taskId: z.string().min(1),
  entityType: z.enum(["PROJECT", "CLIENT", "CONTRACT", "ASSET", "TASK", "OTHER"]),
  entityId: z.string().min(1, "Enter the linked record's id"),
  relationType: z.string().optional(),
});

export async function addTaskLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) return { error: "Not authorized" };
  const parsed = AddLinkSchema.safeParse({
    taskId: formData.get("taskId"),
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    relationType: formData.get("relationType") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await addTaskLink(tenantId, user.id, parsed.data.taskId, parsed.data.entityType, parsed.data.entityId, parsed.data.relationType);
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function removeTaskLinkAction(linkId: string, taskId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) throw new Error("Not authorized");
  await removeTaskLink(tenantId, linkId);
  revalidatePath(`/tasks/${taskId}`);
}

const SetRecurrenceSchema = z.object({
  taskId: z.string().min(1),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.coerce.number().int().min(1).default(1),
});

export async function setTaskRecurrenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) return { error: "Not authorized" };
  const parsed = SetRecurrenceSchema.safeParse({
    taskId: formData.get("taskId"),
    frequency: formData.get("frequency"),
    interval: formData.get("interval") || 1,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setTaskRecurrence(tenantId, user.id, parsed.data.taskId, parsed.data);
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function stopTaskRecurrenceAction(recurrenceId: string, taskId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) throw new Error("Not authorized");
  await stopTaskRecurrence(tenantId, recurrenceId);
  revalidatePath(`/tasks/${taskId}`);
}

const CreateSavedViewSchema = z.object({
  name: z.string().min(1, "Enter a view name"),
  layout: z.enum(["LIST", "BOARD", "CALENDAR", "TIMELINE"]),
  filtersJson: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

export async function createSavedViewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) return { error: "Not authorized" };
  const parsed = CreateSavedViewSchema.safeParse({
    name: formData.get("name"),
    layout: formData.get("layout"),
    filtersJson: formData.get("filtersJson") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createSavedView(tenantId, user.id, parsed.data);
  revalidatePath("/tasks");
  return { ok: true };
}

export async function deleteSavedViewAction(viewId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) throw new Error("Not authorized");
  await deleteSavedView(tenantId, viewId);
  revalidatePath("/tasks");
}
