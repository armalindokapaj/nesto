import "server-only";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject, requireTenantMember } from "@/lib/tenant";

export async function listProjectApprovals(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  return db.projectApproval.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { displayName: true, avatarColor: true } },
      approver: { select: { displayName: true, avatarColor: true } },
      attachments: { select: { id: true, name: true } },
    },
  });
}

export async function createProjectApproval(
  tenantId: string,
  input: {
    projectId: string;
    requesterId: string;
    title: string;
    description?: string;
    department?: string;
    relatedEntity?: string;
    optionsProposed?: string;
    costImpact?: string;
    timelineImpact?: string;
    technicalImpact?: string;
    approverId: string;
    deadline?: Date;
    attachmentIds?: string[];
  }
) {
  await Promise.all([requireTenantProject(tenantId, input.projectId), requireTenantMember(tenantId, input.approverId)]);

  return db.projectApproval.create({
    data: {
      tenantId,
      projectId: input.projectId,
      requesterId: input.requesterId,
      title: input.title,
      description: input.description,
      department: input.department,
      relatedEntity: input.relatedEntity,
      optionsProposed: input.optionsProposed,
      costImpact: input.costImpact,
      timelineImpact: input.timelineImpact,
      technicalImpact: input.technicalImpact,
      approverId: input.approverId,
      deadline: input.deadline,
      attachments: input.attachmentIds?.length ? { connect: input.attachmentIds.map((id) => ({ id })) } : undefined,
    },
  });
}

export async function decideProjectApproval(
  tenantId: string,
  approvalId: string,
  decidedById: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string
) {
  const approval = assertTenant(await db.projectApproval.findUnique({ where: { id: approvalId } }), tenantId, "ProjectApproval");
  if (approval.approverId !== decidedById) {
    throw new Error("Only the assigned approver can decide this request.");
  }
  return db.projectApproval.update({
    where: { id: approval.id },
    data: { status: decision, decidedAt: new Date(), decisionNote },
  });
}
