"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import {
  createItDevice,
  setItDeviceStatus,
  createSoftwareLicence,
  assignLicenceSeat,
  revokeLicenceSeat,
  createItTicket,
  setItTicketStatus,
  addItTicketComment,
} from "@/server/it-admin";
import { toActionError } from "@/lib/errors";

export type ItAdminActionState = { error: string } | undefined;

const CreateDeviceSchema = z.object({
  name: z.string().min(1, "Enter a device name"),
  deviceType: z.string().min(1),
  ownerUserId: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function createItDeviceAction(_prev: ItAdminActionState, formData: FormData): Promise<ItAdminActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage IT devices." };
  await assertConfigEnabled(tenantId, "it_admin.action.manage_devices");
  const parsed = CreateDeviceSchema.safeParse({
    name: formData.get("name"),
    deviceType: formData.get("deviceType"),
    ownerUserId: formData.get("ownerUserId") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createItDevice(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/admin/it/devices");
  return undefined;
}

export async function setItDeviceStatusAction(deviceId: string, status: string): Promise<ItAdminActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage IT devices." };
  await setItDeviceStatus(tenantId, deviceId, status);
  revalidatePath("/dashboard/admin/it/devices");
  return undefined;
}

const CreateLicenceSchema = z.object({
  productName: z.string().min(1, "Enter a product name"),
  vendor: z.string().optional(),
  seatsTotal: z.coerce.number().int().min(1, "Enter at least 1 seat"),
  costPerSeat: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function createSoftwareLicenceAction(_prev: ItAdminActionState, formData: FormData): Promise<ItAdminActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage software licences." };
  await assertConfigEnabled(tenantId, "it_admin.action.manage_licences");
  const parsed = CreateLicenceSchema.safeParse({
    productName: formData.get("productName"),
    vendor: formData.get("vendor") || undefined,
    seatsTotal: formData.get("seatsTotal"),
    costPerSeat: formData.get("costPerSeat") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createSoftwareLicence(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/admin/it/licences");
  return undefined;
}

export async function assignLicenceSeatAction(licenceId: string, userId: string): Promise<ItAdminActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage software licences." };
  try {
    await assignLicenceSeat(tenantId, licenceId, userId);
  } catch (err) {
    return { error: toActionError(err, "Could not assign seat.") };
  }
  revalidatePath("/dashboard/admin/it/licences");
  return undefined;
}

export async function revokeLicenceSeatAction(assignmentId: string): Promise<ItAdminActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage software licences." };
  await revokeLicenceSeat(tenantId, assignmentId);
  revalidatePath("/dashboard/admin/it/licences");
  return undefined;
}

const CreateTicketSchema = z.object({
  ticketType: z.enum(["REQUEST", "INCIDENT", "PROBLEM", "CHANGE"]),
  title: z.string().min(2, "Enter a title"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

// Anyone in the tenant can raise a service ticket — this is the "everyone
// can ask IT for help" front door, distinct from managing devices/licences.
export async function createItTicketAction(_prev: ItAdminActionState, formData: FormData): Promise<ItAdminActionState> {
  const { tenantId, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "it_admin.action.create_ticket");
  const parsed = CreateTicketSchema.safeParse({
    ticketType: formData.get("ticketType"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const ticket = await createItTicket(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/admin/it/tickets");
  revalidatePath(`/dashboard/admin/it/tickets/${ticket.id}`);
  return undefined;
}

export async function setItTicketStatusAction(ticketId: string, status: string, assignedToId?: string): Promise<ItAdminActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return { error: "You do not have permission to manage service tickets." };
  await assertConfigEnabled(tenantId, "it_admin.action.manage_ticket");
  try {
    await setItTicketStatus(tenantId, ticketId, status, assignedToId);
  } catch (err) {
    return { error: toActionError(err, "Could not update ticket.") };
  }
  revalidatePath(`/dashboard/admin/it/tickets/${ticketId}`);
  revalidatePath("/dashboard/admin/it/tickets");
  return undefined;
}

export async function addItTicketCommentAction(_prev: ItAdminActionState, formData: FormData): Promise<ItAdminActionState> {
  const { tenantId, user } = await getCurrentUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) return { error: "Comment cannot be empty." };
  await addItTicketComment(tenantId, ticketId, user.id, body);
  revalidatePath(`/dashboard/admin/it/tickets/${ticketId}`);
  return undefined;
}
