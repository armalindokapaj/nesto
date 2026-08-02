"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getT } from "@/lib/i18n/server";
import { NOTIFICATION_CATEGORIES } from "@/lib/constants";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ["confirmPassword"] });

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const { user } = await getCurrentUser();
  const { t } = await getT();

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.path.includes("confirmPassword"));
    return { error: mismatch ? t("account.passwordMismatch") : "Invalid input" };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: t("account.wrongCurrentPassword") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.userIdentity.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}

export type SavePreferencesState = { success?: boolean } | undefined;

export async function saveNotificationPreferencesAction(
  _prev: SavePreferencesState,
  formData: FormData
): Promise<SavePreferencesState> {
  const { user } = await getCurrentUser();

  await db.$transaction(
    NOTIFICATION_CATEGORIES.map((category) =>
      db.notificationPreference.upsert({
        where: { userId_category: { userId: user.id, category } },
        create: {
          userId: user.id,
          category,
          inApp: formData.get(`${category}_inApp`) === "on",
          email: formData.get(`${category}_email`) === "on",
          whatsapp: formData.get(`${category}_whatsapp`) === "on",
        },
        update: {
          inApp: formData.get(`${category}_inApp`) === "on",
          email: formData.get(`${category}_email`) === "on",
          whatsapp: formData.get(`${category}_whatsapp`) === "on",
        },
      })
    )
  );

  revalidatePath("/account");
  return { success: true };
}
