"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createProjectApproval, decideProjectApproval } from "@/server/project-approvals";

const CreateApprovalSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2, "Enter a title"),
  description: z.string().optional(),
  department: z.string().optional(),
  relatedEntity: z.string().optional(),
  optionsProposed: z.string().optional(),
  costImpact: z.string().optional(),
  timelineImpact: z.string().optional(),
  technicalImpact: z.string().optional(),
  approverId: z.string().min(1, "Choose an approver"),
  deadline: z.coerce.date().optional(),
});

export type ApprovalState = { error: string } | undefined;

export async function createApprovalAction(_prev: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to request approvals." };
  }

  const parsed = CreateApprovalSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    department: formData.get("department") || undefined,
    relatedEntity: formData.get("relatedEntity") || undefined,
    optionsProposed: formData.get("optionsProposed") || undefined,
    costImpact: formData.get("costImpact") || undefined,
    timelineImpact: formData.get("timelineImpact") || undefined,
    technicalImpact: formData.get("technicalImpact") || undefined,
    approverId: formData.get("approverId"),
    deadline: formData.get("deadline") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const attachmentIds = formData.getAll("attachmentIds").map(String).filter(Boolean);
  await createProjectApproval(tenantId, { ...parsed.data, requesterId: user.id, attachmentIds });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return undefined;
}

export async function decideApprovalAction(
  projectId: string,
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string
) {
  const { tenantId, user } = await getCurrentUser();
  await decideProjectApproval(tenantId, approvalId, user.id, decision, decisionNote);
  revalidatePath(`/projects/${projectId}`);
}
