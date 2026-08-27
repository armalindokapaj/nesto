"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { assignTraining, updateTrainingStatus } from "@/server/training";
import type { Role } from "@/lib/constants";
import { toActionError } from "@/lib/errors";

export type TrainingActionState = { error?: string; success?: boolean } | undefined;

const AssignTrainingSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1, "Enter a training/course name"),
  provider: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function assignTrainingAction(_prev: TrainingActionState, formData: FormData): Promise<TrainingActionState> {
  const { tenantId, user, role } = await getCurrentUser();
  const parsed = AssignTrainingSchema.safeParse({
    employeeId: formData.get("employeeId"),
    name: formData.get("name"),
    provider: formData.get("provider") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await assignTraining(tenantId, { userId: user.id, role: role as Role }, parsed.data);
  } catch (err) {
    return { error: toActionError(err, "Something went wrong.") };
  }
  revalidatePath("/dashboard/hr/training");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { success: true };
}

export async function updateTrainingStatusAction(
  trainingId: string,
  employeeId: string,
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED"
) {
  const { tenantId, user, role } = await getCurrentUser();
  await updateTrainingStatus(tenantId, { userId: user.id, role: role as Role }, trainingId, status);
  revalidatePath("/dashboard/hr/training");
  revalidatePath(`/employees/${employeeId}`);
}
