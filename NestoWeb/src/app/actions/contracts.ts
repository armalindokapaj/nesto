"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createContract } from "@/server/contracts";

const CreateContractSchema = z.object({
  title: z.string().min(2, "Enter a contract title"),
  value: z.coerce.number().positive("Enter a contract value"),
  currency: z.string().optional(),
  projectId: z.string().optional(),
  contractorId: z.string().optional(),
});

export type CreateContractState = { error: string } | undefined;

export async function createContractAction(_prev: CreateContractState, formData: FormData): Promise<CreateContractState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CONTRACTS", "WRITE")) {
    return { error: "You do not have permission to create contracts." };
  }

  const parsed = CreateContractSchema.safeParse({
    title: formData.get("title"),
    value: formData.get("value"),
    currency: formData.get("currency") || undefined,
    projectId: formData.get("projectId") || undefined,
    contractorId: formData.get("contractorId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createContract(tenantId, parsed.data);
  revalidatePath("/contracts");
  return undefined;
}
