"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createBudget, reviseBudget, closeBudget } from "@/server/finance";

type ActionState = { error: string } | { ok: true } | undefined;

function assertFinanceWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "FINANCE", "WRITE")) throw new Error("Not authorized");
}

const CreateBudgetSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().optional(),
  period: z.string().min(1, "Enter a period, e.g. 2026 or 2026-Q3"),
  baselineAmount: z.coerce.number().positive("Enter an amount"),
  currency: z.string().min(1),
  costCenter: z.string().optional(),
});

export async function createBudgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateBudgetSchema.safeParse({
    companyId: formData.get("companyId"),
    projectId: formData.get("projectId") || undefined,
    period: formData.get("period"),
    baselineAmount: formData.get("baselineAmount"),
    currency: formData.get("currency") || "EUR",
    costCenter: formData.get("costCenter") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await createBudget(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create budget" };
  }

  revalidatePath("/dashboard/finance/budgets");
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

const ReviseBudgetSchema = z.object({
  budgetId: z.string().min(1),
  newAmount: z.coerce.number().positive("Enter an amount"),
  reason: z.string().optional(),
});

export async function reviseBudgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = ReviseBudgetSchema.safeParse({
    budgetId: formData.get("budgetId"),
    newAmount: formData.get("newAmount"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await reviseBudget(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not revise budget" };
  }

  revalidatePath(`/dashboard/finance/budgets/${parsed.data.budgetId}`);
  revalidatePath("/dashboard/finance/budgets");
  return { ok: true };
}

export async function closeBudgetAction(budgetId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertFinanceWrite(role);
  await closeBudget(tenantId, budgetId);
  revalidatePath("/dashboard/finance/budgets");
}
