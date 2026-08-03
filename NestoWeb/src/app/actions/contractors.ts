"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createContractor, updateContractorFinancialDetails } from "@/server/contractors";

const CreateContractorSchema = z.object({
  name: z.string().min(2, "Enter a contractor name"),
  tradeType: z.string().min(2, "Enter a trade type"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export type CreateContractorState = { error: string; success?: undefined } | { success: true; id: string; name: string } | undefined;

export async function createContractorAction(
  _prev: CreateContractorState,
  formData: FormData
): Promise<CreateContractorState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_NETWORK", "WRITE")) {
    return { error: "You do not have permission to add contractors." };
  }

  const parsed = CreateContractorSchema.safeParse({
    name: formData.get("name"),
    tradeType: formData.get("tradeType"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const contractor = await createContractor(tenantId, { ...parsed.data, email: parsed.data.email || undefined });
  revalidatePath("/contractors");
  revalidatePath("/contracts");
  return { success: true, id: contractor.id, name: contractor.name };
}

const FinancialDetailsSchema = z.object({
  contractorId: z.string().min(1),
  taxId: z.string().optional(),
  bankAccount: z.string().optional(),
});

export type UpdateFinancialDetailsState = { error?: string; success?: boolean } | undefined;

export async function updateContractorFinancialDetailsAction(
  _prev: UpdateFinancialDetailsState,
  formData: FormData
): Promise<UpdateFinancialDetailsState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_NETWORK", "WRITE")) {
    return { error: "You do not have permission to edit contractor details." };
  }

  const parsed = FinancialDetailsSchema.safeParse({
    contractorId: formData.get("contractorId"),
    taxId: formData.get("taxId") || undefined,
    bankAccount: formData.get("bankAccount") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  await updateContractorFinancialDetails(tenantId, parsed.data.contractorId, {
    taxId: parsed.data.taxId,
    bankAccount: parsed.data.bankAccount,
  });
  revalidatePath(`/contractors/${parsed.data.contractorId}`);
  return { success: true };
}
