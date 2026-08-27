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
  recordClientUnitInterest,
  createReservation,
  releaseReservation,
  recordUnitSale,
  logCommunication,
  createSupportCase,
  updateSupportCaseStatus,
} from "@/server/crm-module";
import { toActionError } from "@/lib/errors";

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
    return { error: toActionError(error, "Could not update client") };
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
  const { tenantId, role, user } = await getCurrentUser();
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
    await addContact(tenantId, { ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not add contact") };
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
    return { error: toActionError(error, "Could not add note") };
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
    return { error: toActionError(error, "Could not create lead") };
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
    await createOpportunity(tenantId, { ...parsed.data, ownerId: user.id, actorId: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not create opportunity") };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  revalidatePath("/clients/pipeline");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

export async function moveOpportunityStageAction(opportunityId: string, stageId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertClientsWrite(role);
  await moveOpportunityStage(tenantId, { opportunityId, stageId, actorId: user.id });
  revalidatePath("/clients/pipeline");
  revalidatePath("/dashboard/sales");
}

export async function closeOpportunityAction(opportunityId: string, status: "WON" | "LOST", lostReason?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertClientsWrite(role);
  await closeOpportunity(tenantId, { opportunityId, status, lostReason, actorId: user.id });
  revalidatePath("/clients/pipeline");
  revalidatePath("/dashboard/sales");
}

// ---------------------------------------------------------------------------
// Reservations & Sales/Units (PRD_Sales_Dashboard §12/§13)
// ---------------------------------------------------------------------------

const InterestSchema = z.object({
  clientId: z.string().min(1),
  unitId: z.string().min(1),
  type: z.enum(["INTERESTED", "VIEWED", "RELEASED"]),
});

export async function recordClientUnitInterestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = InterestSchema.safeParse({ clientId: formData.get("clientId"), unitId: formData.get("unitId"), type: formData.get("type") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertClientsWrite(role);
    await recordClientUnitInterest(tenantId, { ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not record interest") };
  }
  revalidatePath("/clients/reservations");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

const CreateReservationSchema = z.object({
  clientId: z.string().min(1),
  unitId: z.string().min(1),
  reservationDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  depositAmount: z.coerce.number().optional(),
  depositStatus: z.string().optional(),
});

export async function createReservationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateReservationSchema.safeParse({
    clientId: formData.get("clientId"),
    unitId: formData.get("unitId"),
    reservationDate: formData.get("reservationDate") || new Date(),
    expirationDate: formData.get("expirationDate") || undefined,
    depositAmount: formData.get("depositAmount") || undefined,
    depositStatus: formData.get("depositStatus") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertClientsWrite(role);
    await createReservation(tenantId, { ...parsed.data, salespersonId: user.id, actorId: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not create reservation") };
  }
  revalidatePath("/clients/reservations");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

export async function releaseReservationAction(relationshipId: string): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  try {
    assertClientsWrite(role);
    await releaseReservation(tenantId, { relationshipId, actorId: user.id });
  } catch (error) {
    // Was uncaught, so a double-click surfaced as an unhandled server-action
    // rejection rather than a message. Its siblings above already do this.
    return { error: toActionError(error, "Could not release reservation") };
  }
  revalidatePath("/clients/reservations");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

const RecordSaleSchema = z.object({
  clientId: z.string().min(1),
  unitId: z.string().min(1),
  type: z.enum(["PURCHASED", "RENTED"]),
  askingPrice: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  finalPrice: z.coerce.number().optional(),
  saleDate: z.coerce.date(),
});

export async function recordUnitSaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = RecordSaleSchema.safeParse({
    clientId: formData.get("clientId"),
    unitId: formData.get("unitId"),
    type: formData.get("type"),
    askingPrice: formData.get("askingPrice") || undefined,
    discount: formData.get("discount") || undefined,
    finalPrice: formData.get("finalPrice") || undefined,
    saleDate: formData.get("saleDate") || new Date(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertClientsWrite(role);
    await recordUnitSale(tenantId, { ...parsed.data, salespersonId: user.id, actorId: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not record sale") };
  }
  revalidatePath("/clients/reservations");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Communications (PRD_Sales_Dashboard §17 sidebar item)
// ---------------------------------------------------------------------------

const LogCommunicationSchema = z.object({
  clientId: z.string().min(1),
  contactId: z.string().optional(),
  channel: z.string().min(1),
  direction: z.string().optional(),
  subject: z.string().optional(),
  notes: z.string().min(1, "Write what was discussed"),
});

export async function logCommunicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = LogCommunicationSchema.safeParse({
    clientId: formData.get("clientId"),
    contactId: formData.get("contactId") || undefined,
    channel: formData.get("channel"),
    direction: formData.get("direction") || undefined,
    subject: formData.get("subject") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertClientsWrite(role);
    await logCommunication(tenantId, { ...parsed.data, loggedById: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not log communication") };
  }
  revalidatePath("/clients/communications");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Support cases (PRD_Sales_Dashboard §6 After Sales > Support)
// ---------------------------------------------------------------------------

const CreateSupportCaseSchema = z.object({
  clientId: z.string().min(1),
  subject: z.string().min(1, "Enter a subject"),
  description: z.string().optional(),
  priority: z.string().optional(),
  assignedToId: z.string().optional(),
});

export async function createSupportCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateSupportCaseSchema.safeParse({
    clientId: formData.get("clientId"),
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertClientsWrite(role);
    await createSupportCase(tenantId, { ...parsed.data, createdById: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not create support case") };
  }
  revalidatePath("/clients/support");
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

export async function updateSupportCaseStatusAction(caseId: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  assertClientsWrite(role);
  await updateSupportCaseStatus(tenantId, { caseId, status });
  revalidatePath("/clients/support");
}
