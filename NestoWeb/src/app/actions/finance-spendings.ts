"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createSpendingBill,
  submitSpendingBill,
  decideSpendingBill,
  markSpendingBillPaid,
} from "@/server/finance";
import type { DecisionValue } from "@/server/workflow-engine";
import { toActionError } from "@/lib/errors";

// PRD_Finance_Dashboard §11/§21 — Spending Bill actions. Scoped to
// FINANCE:WRITE — this is the Finance shell's own operational workflow
// (§1 "authorized Finance users"), not a company-wide expense-claim tool.

type ActionState = { error: string } | { ok: true } | undefined;

function assertFinanceWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "FINANCE", "WRITE")) throw new Error("Not authorized");
}

const CreateSpendingBillSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().optional(),
  category: z.string().min(1, "Choose a category"),
  amount: z.coerce.number().positive("Enter an amount"),
  currency: z.string().min(1),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  evidenceDataUrl: z.string().optional(),
  evidenceWaived: z.boolean().optional(),
  costCenter: z.string().optional(),
});

export async function createSpendingBillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateSpendingBillSchema.safeParse({
    companyId: formData.get("companyId"),
    projectId: formData.get("projectId") || undefined,
    category: formData.get("category"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "EUR",
    supplierId: formData.get("supplierId") || undefined,
    description: formData.get("description") || undefined,
    evidenceDataUrl: formData.get("evidenceDataUrl") || undefined,
    evidenceWaived: formData.get("evidenceWaived") === "on",
    costCenter: formData.get("costCenter") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await createSpendingBill(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create Spending Bill") };
  }

  revalidatePath("/dashboard/finance/spendings");
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

export async function submitSpendingBillAction(spendingBillId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertFinanceWrite(role);
  await submitSpendingBill(tenantId, user.id, spendingBillId);
  revalidatePath("/dashboard/finance/spendings");
  revalidatePath("/dashboard/finance");
}

export async function decideSpendingBillAction(spendingBillId: string, decision: DecisionValue, comment?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) throw new Error("Not authorized");
  await decideSpendingBill(tenantId, user.id, role, spendingBillId, decision, comment);
  revalidatePath("/dashboard/finance/spendings");
  revalidatePath("/dashboard/finance");
}

export async function markSpendingBillPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const spendingBillId = formData.get("spendingBillId");
  const transferReference = formData.get("transferReference");
  if (typeof spendingBillId !== "string" || typeof transferReference !== "string") return { error: "Invalid input" };

  try {
    assertFinanceWrite(role);
    await markSpendingBillPaid(tenantId, user.id, { spendingBillId, transferReference });
  } catch (error) {
    return { error: toActionError(error, "Could not mark paid") };
  }

  revalidatePath("/dashboard/finance/spendings");
  revalidatePath("/dashboard/finance");
  return { ok: true };
}
