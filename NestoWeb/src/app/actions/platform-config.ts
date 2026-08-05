"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { setConfigNodeEnabled, clearConfigOverride } from "@/server/platform-config";
import type { Role } from "@/lib/constants";

// Platform Configuration — toggling is company governance, so it is gated on
// COMPANY_SETTINGS rather than on the module being configured. Otherwise a
// role could switch off a module it merely has write access to.
function assertConfigAdmin(role: Role) {
  if (!can(role, "COMPANY_SETTINGS", "FULL")) {
    throw new Error("Not authorized to change platform configuration.");
  }
}

export async function toggleConfigNodeAction(nodeKey: string, enabled: boolean) {
  const { tenantId, role, user } = await getCurrentUser();
  assertConfigAdmin(role as Role);

  await setConfigNodeEnabled({ tenantId, nodeKey, enabled, updatedById: user.id });

  revalidatePath("/dashboard/admin/configuration");
  // The sidebar is rendered in the workspace layout and filters on the
  // resolved routes, so it has to be revalidated too or a just-disabled module
  // keeps its nav entry until the next full navigation.
  revalidatePath("/", "layout");
}

export async function clearConfigOverrideAction(nodeKey: string) {
  const { tenantId, role } = await getCurrentUser();
  assertConfigAdmin(role as Role);

  await clearConfigOverride({ tenantId, nodeKey });

  revalidatePath("/dashboard/admin/configuration");
  revalidatePath("/", "layout");
}
