"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createLeaveRequest, decideLeaveRequest, cancelApprovedLeave, updateApprovedLeave } from "@/server/hr";

const CreateEmployeeSchema = z.object({
  fullName: z.string().min(2),
  position: z.string().min(1),
  department: z.string().min(1),
  hireDate: z.coerce.date(),
});

export type CreateEmployeeState = { error: string } | undefined;

export async function createEmployeeAction(_prev: CreateEmployeeState, formData: FormData): Promise<CreateEmployeeState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    return { error: "You do not have permission to add employees." };
  }

  const parsed = CreateEmployeeSchema.safeParse({
    fullName: formData.get("fullName"),
    position: formData.get("position"),
    department: formData.get("department"),
    hireDate: formData.get("hireDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.employee.create({ data: { tenantId, ...parsed.data } });
  revalidatePath("/dashboard/hr/employees");
  revalidatePath("/dashboard/hr");
  return undefined;
}

const CreateLeaveSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export type CreateLeaveState = { error: string } | undefined;

// PRD_9 LEV-001 — reachable both from HR's "on behalf of any employee"
// dialog and from an employee's or direct superior's own request on
// /calendar; the three-way permission check below is what tells them apart.
export async function createLeaveRequestAction(_prev: CreateLeaveState, formData: FormData): Promise<CreateLeaveState> {
  const { tenantId, role, user } = await getCurrentUser();

  const parsed = CreateLeaveSchema.safeParse({
    employeeId: formData.get("employeeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  if (!can(role, "HR", "WRITE")) {
    const [target, own] = await Promise.all([
      db.employee.findUnique({ where: { id: parsed.data.employeeId } }),
      db.employee.findFirst({ where: { tenantId, userId: user.id } }),
    ]);
    const isSelf = target?.userId === user.id;
    const isDirectSuperior = Boolean(own && target?.managerId === own.id);
    if (!target || target.tenantId !== tenantId || (!isSelf && !isDirectSuperior)) {
      return { error: "You do not have permission to submit a leave request for this person." };
    }
  }

  await createLeaveRequest(tenantId, parsed.data.employeeId, user.id, {
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
  return undefined;
}

export async function decideLeaveRequestAction(leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    throw new Error("You do not have permission to decide leave requests.");
  }

  await decideLeaveRequest(tenantId, user.id, leaveRequestId, decision);
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
}

// PRD_9 LEV-003 — only HR (HR-FULL) may touch an approved entry afterward.
export async function cancelApprovedLeaveAction(leaveRequestId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    throw new Error("You do not have permission to cancel leave.");
  }
  await cancelApprovedLeave(tenantId, user.id, leaveRequestId);
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
}

const UpdateLeaveSchema = z.object({
  leaveRequestId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export type UpdateLeaveState = { error: string } | undefined;

export async function updateApprovedLeaveAction(_prev: UpdateLeaveState, formData: FormData): Promise<UpdateLeaveState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    return { error: "You do not have permission to edit leave." };
  }

  const parsed = UpdateLeaveSchema.safeParse({
    leaveRequestId: formData.get("leaveRequestId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await updateApprovedLeave(tenantId, user.id, parsed.data.leaveRequestId, {
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
  return undefined;
}
