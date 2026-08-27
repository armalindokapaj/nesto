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

  // This checked *who* may decide but never *whether it was already decided*,
  // so a second call with the opposite decision silently overwrote status,
  // decidedAt and decisionNote with no record that another decision was ever
  // made. Its three siblings all guard this: workflow-engine's decide()
  // (stage.status !== "ACTIVE"), procurement-comparison's decideAward()
  // (award.status !== "SUBMITTED") and contract-lifecycle's approveContract()
  // (assertTransition). These are cost/timeline/technical-impact change
  // requests on a project — governance decisions, not cosmetic ones.
  if (approval.status !== "PENDING") {
    throw new Error(`This request has already been decided (status: ${approval.status}).`);
  }
  if (approval.approverId !== decidedById) {
    throw new Error("Only the assigned approver can decide this request.");
  }
  // Separation of duties, mirroring decideAward() and the workflow engine.
  // Belt-and-braces alongside the approverId check, since createProjectApproval
  // does not stop requesterId and approverId being the same person.
  if (approval.requesterId === decidedById) {
    throw new Error("You cannot decide a request you submitted yourself.");
  }

  // Conditional write rather than a bare update, same reason as the unit sales
  // paths: the read above is a separate statement, so two simultaneous
  // decisions would both pass the PENDING check. Whoever loses matches no row.
  const result = await db.projectApproval.updateMany({
    where: { id: approval.id, status: "PENDING" },
    data: { status: decision, decidedAt: new Date(), decisionNote },
  });
  if (result.count === 0) {
    throw new Error("This request was just decided by someone else. Reload and try again.");
  }

  // ProjectApproval was absent from every AuditEvent write path, so this
  // decision left no trail anywhere — unlike all three of its siblings.
  await db.auditEvent.create({
    data: {
      tenantId,
      actorId: decidedById,
      action: `PROJECT_APPROVAL_${decision}`,
      targetType: "ProjectApproval",
      targetId: approval.id,
      metadata: JSON.stringify({ decisionNote: decisionNote ?? null, projectId: approval.projectId }),
    },
  });

  return db.projectApproval.findUniqueOrThrow({ where: { id: approval.id } });
}
