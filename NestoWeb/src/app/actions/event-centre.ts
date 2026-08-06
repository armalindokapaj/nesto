"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { hasCapability } from "@/server/capabilities";
import {
  setNotificationPolicy,
  setQuietHours,
  setDigestRule,
  createAnnouncement,
  acknowledgeAnnouncement,
  activateEmergencyAlert,
  resolveEmergencyAlert,
} from "@/server/event-centre";

type ActionState = { error: string } | { ok: true } | undefined;

export async function setNotificationPolicyAction(eventKey: string, mandatory: boolean, inAppEnabled: boolean) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) throw new Error("You do not have permission to manage notification policy.");
  await setNotificationPolicy(tenantId, user.id, eventKey, { mandatory, inAppEnabled });
  revalidatePath("/dashboard/admin/event-centre");
}

const QuietHoursSchema = z.object({
  timezone: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.coerce.boolean(),
});

export async function setQuietHoursAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, user } = await getCurrentUser();
  const parsed = QuietHoursSchema.safeParse({
    timezone: formData.get("timezone"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setQuietHours(tenantId, user.id, parsed.data);
  revalidatePath("/account");
  return { ok: true };
}

const DigestRuleSchema = z.object({
  frequency: z.enum(["OFF", "DAILY", "WEEKLY"]),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function setDigestRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, user } = await getCurrentUser();
  const parsed = DigestRuleSchema.safeParse({ frequency: formData.get("frequency"), timeOfDay: formData.get("timeOfDay") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setDigestRule(tenantId, user.id, parsed.data);
  revalidatePath("/account");
  return { ok: true };
}

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1, "Enter a title"),
  body: z.string().min(1, "Enter the announcement body"),
  audienceType: z.enum(["ALL", "ROLE", "DEPARTMENT"]),
  audienceValue: z.string().optional(),
  mandatoryAck: z.coerce.boolean(),
  expiresAt: z.coerce.date().optional(),
});

export async function createAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) return { error: "You do not have permission to publish announcements." };
  const parsed = CreateAnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audienceType: formData.get("audienceType"),
    audienceValue: formData.get("audienceValue") || undefined,
    mandatoryAck: formData.get("mandatoryAck") === "on",
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createAnnouncement(tenantId, user.id, parsed.data);
  revalidatePath("/announcements");
  return { ok: true };
}

export async function acknowledgeAnnouncementAction(announcementId: string) {
  const { tenantId, user } = await getCurrentUser();
  await acknowledgeAnnouncement(tenantId, announcementId, user.id);
  revalidatePath("/announcements");
}

const ActivateAlertSchema = z.object({
  title: z.string().min(1, "Enter a title"),
  body: z.string().min(1, "Describe the emergency"),
});

export async function activateEmergencyAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!(await hasCapability(tenantId, user.id, role, "notifications.emergency_alert.activate"))) {
    return { error: "You are not authorized to activate an emergency alert." };
  }
  const parsed = ActivateAlertSchema.safeParse({ title: formData.get("title"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await activateEmergencyAlert(tenantId, user.id, parsed.data);
  revalidatePath("/announcements");
  return { ok: true };
}

export async function resolveEmergencyAlertAction(alertId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!(await hasCapability(tenantId, user.id, role, "notifications.emergency_alert.activate"))) {
    throw new Error("You are not authorized to resolve an emergency alert.");
  }
  await resolveEmergencyAlert(tenantId, user.id, alertId);
  revalidatePath("/announcements");
}
