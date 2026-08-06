"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import { registerDevice, revokeDevice } from "@/server/mobile-access";
import { db } from "@/lib/db";

export type MobileAccessActionState = { error: string } | undefined;

const RegisterDeviceSchema = z.object({
  platform: z.enum(["IOS", "ANDROID", "WEB"]),
  deviceLabel: z.string().min(1, "Give this device a label"),
});

export async function registerDeviceAction(_prev: MobileAccessActionState, formData: FormData): Promise<MobileAccessActionState> {
  const { tenantId, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "mobile_access.action.register_device");
  const parsed = RegisterDeviceSchema.safeParse({ platform: formData.get("platform"), deviceLabel: formData.get("deviceLabel") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await registerDevice(tenantId, user.id, parsed.data);
  revalidatePath("/account/devices");
  return undefined;
}

/** Any user may revoke their own device; USER_MANAGEMENT/FULL may revoke anyone's (admin console). */
export async function revokeDeviceAction(deviceId: string): Promise<MobileAccessActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "mobile_access.action.revoke_device");
  const device = await db.registeredDevice.findUnique({ where: { id: deviceId } });
  if (!device || device.tenantId !== tenantId) return { error: "Device not found." };
  if (device.userId !== user.id && !can(role, "USER_MANAGEMENT", "FULL")) {
    return { error: "You do not have permission to revoke this device." };
  }
  await revokeDevice(tenantId, deviceId);
  revalidatePath("/account/devices");
  revalidatePath("/dashboard/admin/devices");
  return undefined;
}
