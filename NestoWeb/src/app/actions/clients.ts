"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createClient } from "@/server/clients";
import { createClientCommentWithMentions, type MentionInput } from "@/server/client-mentions";
import { DEPARTMENT_ROLES } from "@/lib/constants";

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

// PRD_3 — mentions arrive as a JSON-encoded array (built by the client-side
// mention composer) rather than repeated form fields, since each mention
// carries a type plus either a userId or a department role.
const MentionSchema = z.union([
  z.object({ type: z.literal("USER"), userId: z.string().min(1) }),
  z.object({ type: z.literal("DEPARTMENT"), role: z.enum(DEPARTMENT_ROLES) }),
]);

const CreateClientCommentSchema = z.object({
  clientId: z.string().min(1),
  body: z.string().min(1, "Write a comment first"),
  mentions: z.array(MentionSchema).default([]),
  createTask: z.boolean().default(false),
  taskTitle: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.coerce.date().optional(),
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

  const mentionsRaw = formData.get("mentions");
  let mentions: unknown = [];
  try {
    mentions = mentionsRaw ? JSON.parse(String(mentionsRaw)) : [];
  } catch {
    return { error: "Invalid mention data" };
  }

  const parsed = CreateClientCommentSchema.safeParse({
    clientId: formData.get("clientId"),
    body: formData.get("body"),
    mentions,
    createTask: formData.get("createTask") === "true",
    taskTitle: formData.get("taskTitle") || undefined,
    priority: formData.get("priority") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // A mention is a routing instruction, not an approval — but creating the
  // resulting task still requires the same TASKS:WRITE gate any other task
  // creation does (CCT-004). If the commenter lacks it, the comment still
  // posts; it just can't spawn a task.
  const canCreateTask = can(role, "TASKS", "WRITE");

  await createClientCommentWithMentions(tenantId, user.id, {
    clientId: parsed.data.clientId,
    body: parsed.data.body,
    createTask: parsed.data.createTask && canCreateTask,
    mentions: parsed.data.mentions as MentionInput[],
    taskTitle: parsed.data.taskTitle,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate,
  });
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return undefined;
}
