"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { setModuleEnabled } from "@/server/company-modules";
import type { ModuleKey } from "@/lib/modules";
import type { Role } from "@/lib/constants";

export async function toggleModuleAction(moduleKey: ModuleKey, enabled: boolean) {
  const { tenantId, role } = await getCurrentUser();
  await setModuleEnabled(tenantId, role as Role, moduleKey, enabled);
  revalidatePath("/dashboard/admin/subscription");
  revalidatePath("/", "layout");
}
