"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createAccount,
  createCostCenter,
  createFiscalPeriod,
  updateFiscalPeriodStatus,
  createJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
} from "@/server/finance";
import type { AccountType } from "@/lib/finance-constants";
import { toActionError } from "@/lib/errors";

// PRD_Finance_Module — Accounting Core actions. Gated on FINANCE:WRITE for
// day-to-day entries, FINANCE:FULL for posting/reversing and period control
// (the immutability-affecting operations) — mirroring how CONTRACTS:FULL
// gates lifecycle transitions elsewhere in this codebase.

type ActionState = { error: string } | { ok: true } | undefined;

function assertFinanceWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "FINANCE", "WRITE")) throw new Error("Not authorized");
}
function assertFinanceFull(role: Parameters<typeof can>[0]) {
  if (!can(role, "FINANCE", "FULL")) throw new Error("Not authorized");
}

const AccountSchema = z.object({
  code: z.string().min(1, "Enter an account code"),
  name: z.string().min(1, "Enter an account name"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: z.string().optional(),
  costCenterRequired: z.boolean().optional(),
});

export async function createAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = AccountSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
    parentId: formData.get("parentId") || undefined,
    costCenterRequired: formData.get("costCenterRequired") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceFull(role);
    await createAccount(tenantId, { ...parsed.data, type: parsed.data.type as AccountType });
  } catch (error) {
    return { error: toActionError(error, "Could not create account") };
  }

  revalidatePath("/finance/accounts");
  return { ok: true };
}

const CostCenterSchema = z.object({ code: z.string().min(1), name: z.string().min(1), parentId: z.string().optional() });

export async function createCostCenterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = CostCenterSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    parentId: formData.get("parentId") || undefined,
  });
  if (!parsed.success) return { error: "Enter a code and a name." };

  try {
    assertFinanceFull(role);
    await createCostCenter(tenantId, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create cost center") };
  }

  revalidatePath("/finance/accounts");
  return { ok: true };
}

const FiscalPeriodSchema = z.object({ name: z.string().min(1), startAt: z.string().min(1), endAt: z.string().min(1) });

export async function createFiscalPeriodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = FiscalPeriodSchema.safeParse({
    name: formData.get("name"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
  });
  if (!parsed.success) return { error: "Enter a name, start date and end date." };

  try {
    assertFinanceFull(role);
    await createFiscalPeriod(tenantId, { name: parsed.data.name, startAt: new Date(parsed.data.startAt), endAt: new Date(parsed.data.endAt) });
  } catch (error) {
    return { error: toActionError(error, "Could not create fiscal period") };
  }

  revalidatePath("/finance/periods");
  return { ok: true };
}

export async function updateFiscalPeriodStatusAction(periodId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertFinanceFull(role);
  await updateFiscalPeriodStatus(tenantId, { periodId, status, actorId: user.id });
  revalidatePath("/finance/periods");
}

const LineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.coerce.number().optional(),
  credit: z.coerce.number().optional(),
  costCenterId: z.string().optional(),
});

const JournalEntrySchema = z.object({
  periodId: z.string().min(1, "Choose a fiscal period"),
  description: z.string().min(1, "Enter a description"),
  lines: z.array(LineSchema).min(2, "Add at least two lines"),
});

export async function createJournalEntryAction(
  _prev: ActionState,
  input: { periodId: string; description: string; lines: { accountId: string; debit?: number; credit?: number; costCenterId?: string }[] }
): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = JournalEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertFinanceWrite(role);
    await createJournalEntry(tenantId, { ...parsed.data, createdById: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not create journal entry") };
  }

  revalidatePath("/finance/journal");
  return { ok: true };
}

export async function postJournalEntryAction(journalEntryId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertFinanceFull(role);
  await postJournalEntry(tenantId, { journalEntryId, actorId: user.id });
  revalidatePath("/finance/journal");
  revalidatePath(`/finance/journal/${journalEntryId}`);
}

export async function reverseJournalEntryAction(journalEntryId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertFinanceFull(role);
  await reverseJournalEntry(tenantId, { journalEntryId, actorId: user.id });
  revalidatePath("/finance/journal");
  revalidatePath(`/finance/journal/${journalEntryId}`);
}
