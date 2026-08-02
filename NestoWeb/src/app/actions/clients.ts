"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createClient } from "@/server/clients";
import { createComment } from "@/server/comments";

const CreateClientSchema = z.object({
  name: z.string().min(2, "Enter a client name"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateClientState = { error: string } | undefined;

export async function createClientAction(_prev: CreateClientState, formData: FormData): Promise<CreateClientState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CLIENTS", "FULL")) {
    return { error: "You do not have permission to create clients." };
  }

  const parsed = CreateClientSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    projectId: formData.get("projectId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createClient(tenantId, user.id, { ...parsed.data, email: parsed.data.email || undefined });
  revalidatePath("/clients");
  return undefined;
}

const CreateClientCommentSchema = z.object({
  clientId: z.string().min(1),
  body: z.string().min(1, "Write a comment first"),
});

export type CreateClientCommentState = { error: string } | undefined;

export async function createClientCommentAction(
  _prev: CreateClientCommentState,
  formData: FormData
): Promise<CreateClientCommentState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CLIENTS", "WRITE")) {
    return { error: "You do not have permission to comment on clients." };
  }

  const parsed = CreateClientCommentSchema.safeParse({
    clientId: formData.get("clientId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createComment(tenantId, user.id, { targetType: "Client", targetId: parsed.data.clientId, body: parsed.data.body });
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return undefined;
}
