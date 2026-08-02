"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createHseReport, updateHseReportStatus } from "@/server/hse";

const CreateHseReportSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  title: z.string().min(2, "Enter a title"),
  description: z.string().min(5, "Describe what was found"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export type CreateHseReportState = { error: string } | undefined;

export async function createHseReportAction(
  _prev: CreateHseReportState,
  formData: FormData
): Promise<CreateHseReportState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) {
    return { error: "You do not have permission to file safety reports." };
  }

  const parsed = CreateHseReportSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createHseReport(tenantId, user.id, parsed.data);
  revalidatePath("/hse-reports");
  return undefined;
}

export async function updateHseReportStatusAction(reportId: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) {
    throw new Error("You do not have permission to update safety reports.");
  }
  await updateHseReportStatus(tenantId, reportId, status);
  revalidatePath("/hse-reports");
}
