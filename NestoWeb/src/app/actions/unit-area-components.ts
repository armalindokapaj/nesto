"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { canManageUnits } from "@/lib/unit-access";
import { replaceUnitAreaComponents, updateUnitFinalPrice } from "@/server/unit-area-components";
import { UNIT_AREA_COMPONENT_TYPES } from "@/lib/constants";
import type { AreaComponentInput } from "@/lib/unit-pricing";
import { toActionError } from "@/lib/errors";

const ComponentSchema = z.object({
  componentType: z.enum(UNIT_AREA_COMPONENT_TYPES),
  label: z.string().min(1),
  areaM2: z.coerce.number().min(0),
  pricePerM2: z.coerce.number().min(0),
  isMain: z.boolean(),
  includedInTotal: z.boolean(),
  order: z.number(),
});

export type ActionState = { error: string } | undefined;

export async function replaceUnitAreaComponentsAction(
  projectId: string,
  unitId: string,
  components: AreaComponentInput[]
): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to edit pricing." };
  }
  const parsed = z.array(ComponentSchema).safeParse(components);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await replaceUnitAreaComponents(tenantId, unitId, user.id, parsed.data);
  } catch (err) {
    return { error: toActionError(err, "Could not save area components.") };
  }
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}/units`);
  return undefined;
}

export async function updateUnitFinalPriceAction(projectId: string, unitId: string, enteredTotal: number): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to edit pricing." };
  }
  try {
    await updateUnitFinalPrice(tenantId, unitId, user.id, enteredTotal);
  } catch (err) {
    return { error: toActionError(err, "Could not update final price.") };
  }
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}/units`);
  return undefined;
}
