"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { setNotificationPolicy } from "@/server/event-centre";

export async function setNotificationPolicyAction(eventKey: string, mandatory: boolean, inAppEnabled: boolean) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) throw new Error("You do not have permission to manage notification policy.");
  await setNotificationPolicy(tenantId, user.id, eventKey, { mandatory, inAppEnabled });
  revalidatePath("/dashboard/admin/event-centre");
}
