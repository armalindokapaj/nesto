"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createDocument } from "@/server/documents";

const CreateDocumentSchema = z.object({
  name: z.string().min(2, "Enter a document name"),
  category: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  taskId: z.string().optional(),
});

export type CreateDocumentState = { error: string } | undefined;

export async function createDocumentAction(_prev: CreateDocumentState, formData: FormData): Promise<CreateDocumentState> {
  const { tenantId, role, user } = await getCurrentUser();

  const parsed = CreateDocumentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    projectId: formData.get("projectId") || undefined,
    clientId: formData.get("clientId") || undefined,
    taskId: formData.get("taskId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // A document attached to a client (contract, floor plan, ...) is gated by
  // CLIENTS access; a task-attached file (PRD_4 §8) by TASKS access;
  // everything else by PROJECTS access.
  const authorized = parsed.data.clientId
    ? can(role, "CLIENTS", "WRITE")
    : parsed.data.taskId
      ? can(role, "TASKS", "WRITE")
      : can(role, "PROJECTS", "WRITE");
  if (!authorized) {
    return { error: "You do not have permission to add documents." };
  }

  await createDocument(tenantId, { ...parsed.data, uploadedById: user.id });
  revalidatePath("/documents");
  if (parsed.data.clientId) revalidatePath(`/clients/${parsed.data.clientId}`);
  if (parsed.data.taskId) revalidatePath(`/tasks/${parsed.data.taskId}`);
  return undefined;
}
