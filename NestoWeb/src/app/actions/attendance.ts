"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { assertConfigEnabled } from "@/server/platform-config";
import { createShiftDefinition, assignSchedule, endScheduleAssignment, getEmployeeByUserId, recordAttendanceEvent } from "@/server/attendance";

export type AttendanceActionState = { error: string } | undefined;

const PATH = "/dashboard/hr/attendance";

function requireWrite(role: Role) {
  if (!can(role, "HR", "WRITE")) return "You do not have permission to manage schedules.";
  return null;
}

const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const CreateShiftSchema = z.object({
  name: z.string().min(1, "Enter a shift name"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  daysOfWeek: z.array(z.string()).min(1, "Select at least one day"),
});

export async function createShiftDefinitionAction(_prev: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_schedule");
  const parsed = CreateShiftSchema.safeParse({
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    daysOfWeek: DAY_CODES.filter((d) => formData.get(`day_${d}`) === "on"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createShiftDefinition(tenantId, user.id, parsed.data);
  revalidatePath(PATH);
  return undefined;
}

export async function assignScheduleAction(employeeId: string, shiftDefinitionId: string): Promise<AttendanceActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_schedule");
  await assignSchedule(tenantId, user.id, employeeId, shiftDefinitionId);
  revalidatePath(PATH);
  return undefined;
}

export async function endScheduleAssignmentAction(assignmentId: string): Promise<AttendanceActionState> {
  const { tenantId, role } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_schedule");
  await endScheduleAssignment(tenantId, assignmentId);
  revalidatePath(PATH);
  return undefined;
}

// Self-service clock in/out — any employee may clock themselves in or out;
// no HR gate, mirrors the self-or-HR pattern used across the employee
// profile (canViewWorkContract / canManageProfile).
export async function clockAction(type: "CLOCK_IN" | "CLOCK_OUT"): Promise<AttendanceActionState> {
  const { tenantId, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "hr.action.clock_attendance");
  const employee = await getEmployeeByUserId(tenantId, user.id);
  if (!employee) return { error: "No employee record is linked to your account." };
  try {
    await recordAttendanceEvent(tenantId, user.id, employee.id, type);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record attendance." };
  }
  revalidatePath(PATH);
  return undefined;
}
