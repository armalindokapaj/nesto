"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

const SettingsSchema = z.object({
  defaultCurrency: z.string().min(1),
  dateFormat: z.string().min(1),
  timeFormat: z.enum(["12H", "24H"]),
  calendarDefault: z.enum(["DAY", "WEEK", "MONTH"]),
});

export type SaveSettingsState = { error?: string; success?: boolean } | undefined;

export async function saveTenantSettingsAction(_prev: SaveSettingsState, formData: FormData): Promise<SaveSettingsState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL") && !can(role, "FINANCE", "FULL")) {
    return { error: "You do not have permission to change these settings." };
  }

  const parsed = SettingsSchema.safeParse({
    defaultCurrency: formData.get("defaultCurrency"),
    dateFormat: formData.get("dateFormat"),
    timeFormat: formData.get("timeFormat"),
    calendarDefault: formData.get("calendarDefault"),
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await db.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/dashboard/finance/settings");
  revalidatePath("/dashboard/hr/settings");
  revalidatePath("/dashboard/architect/settings");
  return { success: true };
}

export async function getOrCreateTenantSettings(tenantId: string) {
  const existing = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return {
    id: "",
    tenantId,
    defaultCurrency: "EUR",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12H",
    calendarDefault: "MONTH",
  };
}
