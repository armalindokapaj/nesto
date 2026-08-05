"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createPayrollGroup,
  createPayrollRun,
  calculatePayrollRun,
  lockPayrollRun,
  cancelPayrollRun,
  createAdjustmentRun,
} from "@/server/payroll";

export type PayrollActionState = { error: string } | undefined;

const CreateGroupSchema = z.object({
  companyId: z.string().min(1, "Select a company"),
  name: z.string().min(1),
  frequency: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY", "ANNUAL"]).optional(),
  currency: z.enum(["EUR", "ALL"]).optional(),
});

export async function createPayrollGroupAction(_prev: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) return { error: "You do not have permission to create payroll groups." };

  const parsed = CreateGroupSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    frequency: formData.get("frequency") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createPayrollGroup(tenantId, parsed.data);
  revalidatePath("/dashboard/hr/payroll");
  return undefined;
}

const CreateRunSchema = z.object({
  payrollGroupId: z.string().min(1, "Select a payroll group"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
});

export async function createPayrollRunAction(_prev: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) return { error: "You do not have permission to create payroll runs." };

  const parsed = CreateRunSchema.safeParse({
    payrollGroupId: formData.get("payrollGroupId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    payDate: formData.get("payDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.periodEnd < parsed.data.periodStart) return { error: "Period end must be after period start." };

  await createPayrollRun(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hr/payroll");
  return undefined;
}

export async function calculatePayrollRunAction(runId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) throw new Error("You do not have permission to calculate payroll runs.");
  await calculatePayrollRun(tenantId, user.id, runId);
  revalidatePath(`/dashboard/hr/payroll/runs/${runId}`);
  revalidatePath("/dashboard/hr/payroll");
}

export async function lockPayrollRunAction(runId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) throw new Error("You do not have permission to lock payroll runs.");
  await lockPayrollRun(tenantId, user.id, runId);
  revalidatePath(`/dashboard/hr/payroll/runs/${runId}`);
  revalidatePath("/dashboard/hr/payroll");
}

export async function cancelPayrollRunAction(runId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) throw new Error("You do not have permission to cancel payroll runs.");
  await cancelPayrollRun(tenantId, user.id, runId);
  revalidatePath(`/dashboard/hr/payroll/runs/${runId}`);
  revalidatePath("/dashboard/hr/payroll");
}

const CreateAdjustmentSchema = z.object({
  adjustsRunId: z.string().min(1),
  payDate: z.coerce.date(),
  reason: z.string().optional(),
});

export async function createAdjustmentRunAction(_prev: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) return { error: "You do not have permission to create adjustment runs." };

  const parsed = CreateAdjustmentSchema.safeParse({
    adjustsRunId: formData.get("adjustsRunId"),
    payDate: formData.get("payDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const run = await createAdjustmentRun(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hr/payroll");
  revalidatePath(`/dashboard/hr/payroll/runs/${parsed.data.adjustsRunId}`);
  revalidatePath(`/dashboard/hr/payroll/runs/${run.id}`);
  return undefined;
}
