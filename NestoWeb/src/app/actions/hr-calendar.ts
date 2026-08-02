"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createHrAppointment } from "@/server/hr-calendar";

const CreateAppointmentSchema = z.object({
  title: z.string().min(2, "Enter a title"),
  type: z.enum(["INTERVIEW", "INTERNAL", "OTHER"]),
  scheduledAt: z.coerce.date(),
  candidateName: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateAppointmentState = { error: string } | undefined;

export async function createAppointmentAction(
  _prev: CreateAppointmentState,
  formData: FormData
): Promise<CreateAppointmentState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "WRITE")) {
    return { error: "You do not have permission to schedule appointments." };
  }

  const parsed = CreateAppointmentSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    scheduledAt: formData.get("scheduledAt"),
    candidateName: formData.get("candidateName") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createHrAppointment(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hr/calendar");
  return undefined;
}
