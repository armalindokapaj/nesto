"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { toggleTaskStar, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from "@/server/tasks-module";

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
