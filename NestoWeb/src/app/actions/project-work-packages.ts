"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createProjectWorkPackage, updateProjectWorkPackageProgress } from "@/server/project-work-packages";

const CreateWorkPackageSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2, "Enter a work name"),
  area: z.string().optional(),
  contractorId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  expectedFinishDate: z.coerce.date().optional(),
  latestUpdate: z.string().optional(),
});

export type WorkPackageState = { error: string } | undefined;

export async function createWorkPackageAction(_prev: WorkPackageState, formData: FormData): Promise<WorkPackageState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to add work packages." };
  }

  const parsed = CreateWorkPackageSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    area: formData.get("area") || undefined,
    contractorId: formData.get("contractorId") || undefined,
    startDate: formData.get("startDate") || undefined,
    expectedFinishDate: formData.get("expectedFinishDate") || undefined,
    latestUpdate: formData.get("latestUpdate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createProjectWorkPackage(tenantId, { ...parsed.data, createdById: user.id });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return undefined;
}

export async function updateWorkPackageProgressAction(
  projectId: string,
  workPackageId: string,
  input: { status?: string; progressPct?: number }
) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    throw new Error("You do not have permission to update work packages.");
  }
  await updateProjectWorkPackageProgress(tenantId, workPackageId, input);
  revalidatePath(`/projects/${projectId}`);
}
