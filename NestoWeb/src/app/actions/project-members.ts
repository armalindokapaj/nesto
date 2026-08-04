"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { addProjectMember, removeProjectMember } from "@/server/project-members";

const AddMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1, "Choose a person"),
  roleOnProject: z.string().optional(),
});

export type AddMemberState = { error: string } | undefined;

export async function addProjectMemberAction(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to manage this project's team." };
  }

  const parsed = AddMemberSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    roleOnProject: formData.get("roleOnProject") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await addProjectMember(tenantId, parsed.data.projectId, { userId: parsed.data.userId, roleOnProject: parsed.data.roleOnProject });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return undefined;
}

export async function removeProjectMemberAction(projectId: string, userId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    throw new Error("You do not have permission to manage this project's team.");
  }
  await removeProjectMember(tenantId, projectId, userId);
  revalidatePath(`/projects/${projectId}`);
}
