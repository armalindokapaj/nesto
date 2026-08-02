"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

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

export async function createLeaveRequestAction(_prev: CreateLeaveState, formData: FormData): Promise<CreateLeaveState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "WRITE")) {
    return { error: "You do not have permission to submit leave requests." };
  }

  const parsed = CreateLeaveSchema.safeParse({
    employeeId: formData.get("employeeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await db.leaveRequest.create({ data: { tenantId, ...parsed.data } });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  return undefined;
}

export async function decideLeaveRequestAction(leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    throw new Error("You do not have permission to decide leave requests.");
  }

  const leave = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!leave || leave.tenantId !== tenantId) {
    throw new Error("Leave request not found.");
  }

  await db.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: decision } });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
}
