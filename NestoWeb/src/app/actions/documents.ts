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
});

export type CreateDocumentState = { error: string } | undefined;

export async function createDocumentAction(_prev: CreateDocumentState, formData: FormData): Promise<CreateDocumentState> {
  const { tenantId, role, user } = await getCurrentUser();

  const parsed = CreateDocumentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    projectId: formData.get("projectId") || undefined,
    clientId: formData.get("clientId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // A document attached to a client (contract, floor plan, ...) is gated by
  // CLIENTS access — Finance/Legal have that without having PROJECTS write.
  const authorized = parsed.data.clientId ? can(role, "CLIENTS", "WRITE") : can(role, "PROJECTS", "WRITE");
  if (!authorized) {
    return { error: "You do not have permission to add documents." };
  }

  await createDocument(tenantId, { ...parsed.data, uploadedById: user.id });
  revalidatePath("/documents");
  if (parsed.data.clientId) revalidatePath(`/clients/${parsed.data.clientId}`);
  return undefined;
}
