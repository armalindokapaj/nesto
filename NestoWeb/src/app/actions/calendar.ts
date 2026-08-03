"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createAgendaEvent, updateAgendaEvent, deleteAgendaEvent, saveReminderPreferences } from "@/server/calendar";
import { db } from "@/lib/db";
import { REMINDER_ITEM_TYPES, THEMES } from "@/lib/constants";
import type { ReminderItemType, Theme } from "@/lib/constants";

const AgendaEventSchema = z.object({
  title: z.string().min(1, "Enter a title"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type AgendaEventState = { error: string } | undefined;

export async function createAgendaEventAction(_prev: AgendaEventState, formData: FormData): Promise<AgendaEventState> {
  const { tenantId, user } = await getCurrentUser();
  const parsed = AgendaEventSchema.safeParse({
    title: formData.get("title"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createAgendaEvent(tenantId, user.id, parsed.data);
  revalidatePath("/calendar");
  return undefined;
}

export async function updateAgendaEventAction(_prev: AgendaEventState, formData: FormData): Promise<AgendaEventState> {
  const { user } = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid input" };

  const parsed = AgendaEventSchema.safeParse({
    title: formData.get("title"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updateAgendaEvent(user.id, id, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath("/calendar");
  return undefined;
}

export async function deleteAgendaEventAction(id: string) {
  const { user } = await getCurrentUser();
  await deleteAgendaEvent(user.id, id);
  revalidatePath("/calendar");
}

export type SaveReminderPreferencesState = { success?: boolean } | undefined;

// PRD_9 §5.1 — belongs to the user account, so it's a plain per-user upsert
// with no tenant/role gating beyond "you can only edit your own".
export async function saveReminderPreferencesAction(
  _prev: SaveReminderPreferencesState,
  formData: FormData
): Promise<SaveReminderPreferencesState> {
  const { user } = await getCurrentUser();

  const minutesByType = Object.fromEntries(
    REMINDER_ITEM_TYPES.map((itemType) => [itemType, Number(formData.get(itemType) ?? 30)])
  ) as Record<ReminderItemType, number>;

  await saveReminderPreferences(user.id, minutesByType);
  revalidatePath("/account");
  return { success: true };
}

export type SaveThemeState = { success?: boolean; error?: string } | undefined;

export async function saveThemeAction(_prev: SaveThemeState, formData: FormData): Promise<SaveThemeState> {
  const { user } = await getCurrentUser();
  const theme = formData.get("theme");
  if (typeof theme !== "string" || !THEMES.includes(theme as Theme)) {
    return { error: "Invalid theme" };
  }

  await db.userIdentity.update({ where: { id: user.id }, data: { theme } });
  // The theme attribute is read in the root layout, outside the (workspace)
  // route group this action is called from — revalidate the whole tree so
  // the new value takes effect on the very next navigation/refresh.
  revalidatePath("/", "layout");
  return { success: true };
}
