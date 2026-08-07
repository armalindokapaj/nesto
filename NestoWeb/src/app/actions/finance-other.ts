"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createLoan, createInvestment } from "@/server/finance-other";

type ActionState = { error: string } | { ok: true } | undefined;

function assertFinanceWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "FINANCE", "WRITE")) throw new Error("Not authorized");
}

const CreateLoanSchema = z.object({
  companyId: z.string().min(1),
  lender: z.string().min(1, "Enter a lender"),
  principal: z.coerce.number().positive("Enter a principal amount"),
  currency: z.string().min(1),
  interestRate: z.coerce.number().optional(),
  outstanding: z.coerce.number().min(0),
  startDate: z.coerce.date(),
  maturityDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function createLoanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateLoanSchema.safeParse({
    companyId: formData.get("companyId"),
    lender: formData.get("lender"),
    principal: formData.get("principal"),
    currency: formData.get("currency") || "EUR",
    interestRate: formData.get("interestRate") || undefined,
    outstanding: formData.get("outstanding") || formData.get("principal"),
    startDate: formData.get("startDate"),
    maturityDate: formData.get("maturityDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await createLoan(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create loan" };
  }

  revalidatePath("/dashboard/finance/loans");
  return { ok: true };
}

const CreateInvestmentSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1, "Enter a name"),
  type: z.string().min(1),
  amount: z.coerce.number().positive("Enter an amount"),
  currency: z.string().min(1),
  currentValue: z.coerce.number().optional(),
  startDate: z.coerce.date(),
  maturityDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function createInvestmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateInvestmentSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    type: formData.get("type") || "OTHER",
    amount: formData.get("amount"),
    currency: formData.get("currency") || "EUR",
    currentValue: formData.get("currentValue") || undefined,
    startDate: formData.get("startDate"),
    maturityDate: formData.get("maturityDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await createInvestment(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create investment" };
  }

  revalidatePath("/dashboard/finance/investments");
  return { ok: true };
}
