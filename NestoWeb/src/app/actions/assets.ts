"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

const CreateAssetSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["EQUIPMENT", "VEHICLE", "TOOL", "OTHER"]),
  purchaseValue: z.coerce.number().optional(),
});

export type CreateAssetState = { error: string } | undefined;

export async function createAssetAction(_prev: CreateAssetState, formData: FormData): Promise<CreateAssetState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "WRITE")) {
    return { error: "You do not have permission to create assets." };
  }

  const parsed = CreateAssetSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    purchaseValue: formData.get("purchaseValue") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.asset.create({ data: { tenantId, ...parsed.data } });
  revalidatePath("/dashboard/finance/assets");
  return undefined;
}
