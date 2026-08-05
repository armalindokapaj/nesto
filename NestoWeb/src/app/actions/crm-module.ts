"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  updateClientCrmFields,
  toggleClientStar,
  archiveClient,
  restoreClient,
  addContact,
  removeContact,
  addClientNote,
  createLead,
  updateLeadStatus,
  convertLead,
  createOpportunity,
  moveOpportunityStage,
  closeOpportunity,
} from "@/server/crm-module";

// PRD_CRM_Module — additive actions. Task/document/comment actions on a
// client continue to run through the existing action files untouched.

type ActionState = { error: string } | { ok: true } | undefined;

function assertClientsWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "CLIENTS", "WRITE")) throw new Error("Not authorized");
}
function assertClientsFull(role: Parameters<typeof can>[0]) {
  if (!can(role, "CLIENTS", "FULL")) throw new Error("Not authorized");
}

const UpdateClientSchema = z.object({
  clientId: z.string().min(1),
  clientType: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().optional(),
  country: z.string().optional(),
  preferredContactMethod: z.string().optional(),
});

export async function updateClientCrmFieldsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = UpdateClientSchema.safeParse({
    clientId: formData.get("clientId"),
    clientType: formData.get("clientType") ?? undefined,
    ownerId: formData.get("ownerId") ?? undefined,
    source: formData.get("source") ?? undefined,
    country: formData.get("country") ?? undefined,
    preferredContactMethod: formData.get("preferredContactMethod") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertClientsWrite(role);
    const { clientId, ...rest } = parsed.data;
    await updateClientCrmFields(tenantId, {
      clientId,
      clientType: rest.clientType || null,
      ownerId: rest.ownerId || null,
      source: rest.source || null,
      country: rest.country || null,
      preferredContactMethod: rest.preferredContactMethod || null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update client" };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true };
}

export async function toggleClientStarAction(clientId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) throw new Error("Not authorized");
  const result = await toggleClientStar(tenantId, clientId, user.id);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return result;
}

export async function archiveClientAction(clientId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsFull(role);
  await archiveClient(tenantId, clientId);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function restoreClientAction(clientId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsFull(role);
  await restoreClient(tenantId, clientId);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

const ContactSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, "Enter a name"),
  title: z.string().optional(),
  department: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
});

export async function addContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = ContactSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    title: formData.get("title") || undefined,
    department: formData.get("department") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertClientsWrite(role);
    await addContact(tenantId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add contact" };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true };
}

export async function removeContactAction(contactId: string, clientId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsWrite(role);
  await removeContact(tenantId, contactId);
  revalidatePath(`/clients/${clientId}`);
}

const NoteSchema = z.object({ clientId: z.string().min(1), body: z.string().min(1, "Write a note first"), pinned: z.boolean().optional() });

export async function addClientNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = NoteSchema.safeParse({
    clientId: formData.get("clientId"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertClientsWrite(role);
    await addClientNote(tenantId, { ...parsed.data, authorId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add note" };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true };
}

const CreateLeadSchema = z.object({
  title: z.string().min(1, "Enter what this lead is interested in"),
  personName: z.string().optional(),
  personEmail: z.string().optional(),
  personPhone: z.string().optional(),
  source: z.string().optional(),
  interest: z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
});

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateLeadSchema.safeParse({
    title: formData.get("title"),
    personName: formData.get("personName") || undefined,
    personEmail: formData.get("personEmail") || undefined,
    personPhone: formData.get("personPhone") || undefined,
    source: formData.get("source") || undefined,
    interest: formData.get("interest") || undefined,
    estimatedValue: formData.get("estimatedValue") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertClientsWrite(role);
    await createLead(tenantId, { ...parsed.data, ownerId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create lead" };
  }

  revalidatePath("/clients/leads");
  return { ok: true };
}

export async function updateLeadStatusAction(leadId: string, status: string, lostReason?: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsWrite(role);
  await updateLeadStatus(tenantId, { leadId, status, lostReason });
  revalidatePath("/clients/leads");
}

export async function convertLeadAction(leadId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertClientsWrite(role);
  const result = await convertLead(tenantId, { leadId, actorId: user.id });
  revalidatePath("/clients/leads");
  revalidatePath("/clients");
  revalidatePath("/clients/pipeline");
  return result;
}

const CreateOpportunitySchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  estimatedValue: z.coerce.number().optional(),
});

export async function createOpportunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateOpportunitySchema.safeParse({
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    estimatedValue: formData.get("estimatedValue") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertClientsWrite(role);
    await createOpportunity(tenantId, { ...parsed.data, ownerId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create opportunity" };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  revalidatePath("/clients/pipeline");
  return { ok: true };
}

export async function moveOpportunityStageAction(opportunityId: string, stageId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsWrite(role);
  await moveOpportunityStage(tenantId, { opportunityId, stageId });
  revalidatePath("/clients/pipeline");
}

export async function closeOpportunityAction(opportunityId: string, status: "WON" | "LOST", lostReason?: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsWrite(role);
  await closeOpportunity(tenantId, { opportunityId, status, lostReason });
  revalidatePath("/clients/pipeline");
}
