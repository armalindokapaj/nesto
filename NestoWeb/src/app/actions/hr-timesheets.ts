"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  getOrCreateTimesheet,
  saveTimesheetLines,
  submitTimesheet,
  verifyTimesheet,
  rejectTimesheet,
} from "@/server/hr-timesheets";

type ActionState = { error: string } | { ok: true; timesheetId?: string } | undefined;

function assertHrWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "HR", "WRITE") && !can(role, "HR", "FULL")) throw new Error("Not authorized");
}

export async function getOrCreateTimesheetAction(employmentId: string, weekStart: string) {
  const { tenantId } = await getCurrentUser();
  return getOrCreateTimesheet(tenantId, employmentId, new Date(weekStart));
}

const LinesSchema = z.object({
  timesheetId: z.string().min(1),
  lines: z.array(
    z.object({
      date: z.coerce.date(),
      projectId: z.string().optional(),
      taskId: z.string().optional(),
      costCode: z.string().optional(),
      hours: z.coerce.number().min(0),
      description: z.string().optional(),
    })
  ),
});

export async function saveTimesheetLinesAction(
  _prev: ActionState,
  input: { timesheetId: string; lines: { date: string; projectId?: string; taskId?: string; costCode?: string; hours: number; description?: string }[] }
): Promise<ActionState> {
  const { tenantId, user } = await getCurrentUser();
  const parsed = LinesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await saveTimesheetLines(tenantId, user.id, { ...parsed.data, lines: parsed.data.lines.filter((l) => l.hours > 0) });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save timesheet" };
  }
  revalidatePath("/dashboard/hr/timesheets");
  return { ok: true, timesheetId: input.timesheetId };
}

export async function submitTimesheetAction(id: string) {
  const { tenantId, user } = await getCurrentUser();
  await submitTimesheet(tenantId, user.id, id);
  revalidatePath("/dashboard/hr/timesheets");
}

export async function verifyTimesheetAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertHrWrite(role);
  await verifyTimesheet(tenantId, user.id, id);
  revalidatePath("/dashboard/hr/timesheets");
  revalidatePath("/dashboard/hr");
}

export async function rejectTimesheetAction(id: string, reason: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertHrWrite(role);
  await rejectTimesheet(tenantId, user.id, id, reason);
  revalidatePath("/dashboard/hr/timesheets");
}
