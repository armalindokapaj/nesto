"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createMeeting, updateMeetingStatus } from "@/server/meetings";

const CreateMeetingSchema = z.object({
  title: z.string().min(2, "Enter a meeting title"),
  scheduledAt: z.coerce.date(),
  location: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateMeetingState = { error: string } | undefined;

export async function createMeetingAction(_prev: CreateMeetingState, formData: FormData): Promise<CreateMeetingState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to schedule meetings." };
  }

  const parsed = CreateMeetingSchema.safeParse({
    title: formData.get("title"),
    scheduledAt: formData.get("scheduledAt"),
    location: formData.get("location") || undefined,
    projectId: formData.get("projectId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createMeeting(tenantId, { ...parsed.data, organiserId: user.id });
  revalidatePath("/meetings");
  if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`);
  return undefined;
}

export async function updateMeetingStatusAction(meetingId: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    throw new Error("You do not have permission to update meetings.");
  }
  await updateMeetingStatus(tenantId, meetingId, status);
  revalidatePath("/meetings");
}
