"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { CAPABILITY_KEYS, type CapabilityKey } from "@/lib/capabilities";
import { grantCapability, revokeCapability } from "@/server/capabilities";

export type CapabilityActionState = { error: string } | undefined;

function assertKnownKey(key: string): asserts key is CapabilityKey {
  if (!CAPABILITY_KEYS.includes(key as CapabilityKey)) throw new Error(`Unknown capability key "${key}".`);
}

export async function grantCapabilityAction(_prev: CapabilityActionState, formData: FormData): Promise<CapabilityActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) return { error: "You do not have permission to manage capability grants." };

  const userId = String(formData.get("userId") ?? "");
  const key = String(formData.get("capabilityKey") ?? "");
  if (!userId) return { error: "Select a user." };
  try {
    assertKnownKey(key);
    await grantCapability(tenantId, user.id, userId, key);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not grant capability." };
  }
  revalidatePath("/dashboard/admin/roles");
  return undefined;
}

export async function revokeCapabilityAction(userId: string, key: string): Promise<CapabilityActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) return { error: "You do not have permission to manage capability grants." };
  try {
    assertKnownKey(key);
    await revokeCapability(tenantId, user.id, userId, key);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not revoke capability." };
  }
  revalidatePath("/dashboard/admin/roles");
  return undefined;
}
