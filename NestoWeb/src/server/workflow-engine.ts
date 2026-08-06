import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Approvals_Workflow_Engine — Phase 1 "Approval foundation" only. See the
// schema comment above WorkflowDefinition for the full scope decision. This
// module owns routing + decisions only; it never applies a source module's
// own business transition — callers must call confirmSourceFinalization
// themselves once they've applied their own state change (WF-FR-015).

export type DecisionValue = "APPROVE" | "REJECT" | "RETURN";

async function logAudit(tenantId: string, actorId: string | undefined, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) {
  return db.auditEvent.create({
    data: { tenantId, actorId, action, targetType, targetId, metadata: metadata ? JSON.stringify(metadata) : undefined },
  });
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export async function listWorkflowDefinitions(tenantId: string) {
  return db.workflowDefinition.findMany({
    where: { tenantId },
    include: { stages: { orderBy: { sequence: "asc" } }, _count: { select: { instances: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWorkflowDefinition(
  tenantId: string,
  actorId: string,
  input: {
    key: string;
    name: string;
    sourceModule: string;
    sourceEntityType: string;
    stages: { name: string; approverRole?: string; approverUserId?: string }[];
  }
) {
  if (input.stages.length === 0) throw new Error("A workflow needs at least one stage.");
  for (const stage of input.stages) {
    if (!stage.approverRole && !stage.approverUserId) {
      throw new Error(`Stage "${stage.name}" needs either an approver role or a specific approver.`);
    }
  }
  const definition = await db.workflowDefinition.create({
    data: {
      tenantId,
      key: input.key,
      name: input.name,
      sourceModule: input.sourceModule,
      sourceEntityType: input.sourceEntityType,
      createdById: actorId,
      stages: {
        create: input.stages.map((s, idx) => ({
          sequence: idx + 1,
          name: s.name,
          approverRole: s.approverRole,
          approverUserId: s.approverUserId,
        })),
      },
    },
    include: { stages: true },
  });
  await logAudit(tenantId, actorId, "WORKFLOW_DEFINITION_CREATED", "WorkflowDefinition", definition.id, { key: definition.key });
  return definition;
}

export async function setWorkflowDefinitionActive(tenantId: string, actorId: string, definitionId: string, isActive: boolean) {
  const def = assertTenant(await db.workflowDefinition.findUnique({ where: { id: definitionId } }), tenantId, "WorkflowDefinition");
  const updated = await db.workflowDefinition.update({ where: { id: def.id }, data: { isActive } });
  await logAudit(tenantId, actorId, isActive ? "WORKFLOW_DEFINITION_ACTIVATED" : "WORKFLOW_DEFINITION_DEACTIVATED", "WorkflowDefinition", def.id);
  return updated;
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

const INSTANCE_INCLUDE = {
  workflowDefinition: true,
  submittedBy: true,
  stages: { orderBy: { sequence: "asc" as const } },
  decisions: { orderBy: { decidedAt: "desc" as const }, include: { decidedBy: true, stageInstance: true } },
};

/**
 * WF-FR-002 idempotency: a duplicate trigger for the same source record
 * while a non-terminal instance already exists returns that instance
 * instead of creating a second one.
 */
export async function startWorkflow(
  tenantId: string,
  actorId: string,
  input: { workflowDefinitionKey: string; sourceEntityId: string; sourceRecordVersion?: number; correlationId?: string }
) {
  const definition = await db.workflowDefinition.findUnique({ where: { tenantId_key: { tenantId, key: input.workflowDefinitionKey } }, include: { stages: { orderBy: { sequence: "asc" } } } });
  if (!definition || !definition.isActive) throw new Error(`No active workflow definition "${input.workflowDefinitionKey}".`);
  if (definition.stages.length === 0) throw new Error("Workflow definition has no stages configured.");

  const existing = await db.workflowInstance.findFirst({
    where: {
      tenantId,
      sourceModule: definition.sourceModule,
      sourceEntityType: definition.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      status: { in: ["PENDING", "SOURCE_FINALIZATION_PENDING"] },
    },
    include: INSTANCE_INCLUDE,
  });
  if (existing) return existing;

  const firstStage = definition.stages[0];
  const instance = await db.workflowInstance.create({
    data: {
      tenantId,
      workflowDefinitionId: definition.id,
      sourceModule: definition.sourceModule,
      sourceEntityType: definition.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      sourceRecordVersion: input.sourceRecordVersion ?? 1,
      submittedById: actorId,
      currentStageSequence: firstStage.sequence,
      correlationId: input.correlationId,
      stages: {
        create: definition.stages.map((s) => ({
          sequence: s.sequence,
          name: s.name,
          approverRole: s.approverRole,
          approverUserId: s.approverUserId,
          status: s.sequence === firstStage.sequence ? "ACTIVE" : "PENDING",
        })),
      },
    },
    include: INSTANCE_INCLUDE,
  });
  await logAudit(tenantId, actorId, "WORKFLOW_STARTED", "WorkflowInstance", instance.id, { definitionKey: definition.key });
  return instance;
}

export async function getWorkflowInstance(tenantId: string, instanceId: string) {
  const instance = assertTenant(await db.workflowInstance.findUnique({ where: { id: instanceId }, include: INSTANCE_INCLUDE }), tenantId, "WorkflowInstance");
  return instance;
}

/** What every source module's embedded status card needs (PRD §38). */
export async function getActiveWorkflowInstance(tenantId: string, sourceModule: string, sourceEntityType: string, sourceEntityId: string) {
  return db.workflowInstance.findFirst({
    where: { tenantId, sourceModule, sourceEntityType, sourceEntityId, status: { in: ["PENDING", "SOURCE_FINALIZATION_PENDING"] } },
    include: INSTANCE_INCLUDE,
  });
}

export async function listWorkflowInstancesForEntity(tenantId: string, sourceModule: string, sourceEntityType: string, sourceEntityId: string) {
  return db.workflowInstance.findMany({
    where: { tenantId, sourceModule, sourceEntityType, sourceEntityId },
    include: INSTANCE_INCLUDE,
    orderBy: { submittedAt: "desc" },
  });
}

/** Work-item queue: active stages assigned to this user by name or by role. */
export async function listMyWorkItems(tenantId: string, userId: string, role: string) {
  return db.workflowStageInstance.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ approverUserId: userId }, { approverRole: role, approverUserId: null }],
      workflowInstance: { tenantId, status: "PENDING" },
    },
    include: { workflowInstance: { include: INSTANCE_INCLUDE } },
    orderBy: { workflowInstance: { submittedAt: "asc" } },
  });
}

export async function listMySubmittedWorkflows(tenantId: string, userId: string) {
  return db.workflowInstance.findMany({
    where: { tenantId, submittedById: userId },
    include: INSTANCE_INCLUDE,
    orderBy: { submittedAt: "desc" },
  });
}

/**
 * WF-FR-007/034 separation of duties: the submitter can never decide their
 * own workflow instance, even if they also happen to hold the approver role.
 */
export async function decide(
  tenantId: string,
  actorId: string,
  actorRole: string,
  stageInstanceId: string,
  decision: DecisionValue,
  comment?: string
) {
  const stage = await db.workflowStageInstance.findUnique({ where: { id: stageInstanceId }, include: { workflowInstance: true } });
  if (!stage) throw new Error("Work item not found.");
  assertTenant(stage.workflowInstance, tenantId, "WorkflowInstance");
  if (stage.status !== "ACTIVE") throw new Error("This stage is not currently awaiting a decision.");
  if (stage.workflowInstance.submittedById === actorId) {
    throw new Error("You cannot decide on a workflow you submitted (separation of duties).");
  }
  const entitled = stage.approverUserId ? stage.approverUserId === actorId : stage.approverRole === actorRole;
  if (!entitled) throw new Error("You are not the assigned approver for this stage.");

  const result = await db.$transaction(async (tx) => {
    await tx.workflowDecision.create({
      data: { tenantId, workflowInstanceId: stage.workflowInstanceId, stageInstanceId: stage.id, decidedById: actorId, decision, comment },
    });

    if (decision === "REJECT") {
      await tx.workflowStageInstance.update({ where: { id: stage.id }, data: { status: "REJECTED", decidedById: actorId, decidedAt: new Date() } });
      const rejected = await tx.workflowInstance.update({
        where: { id: stage.workflowInstanceId },
        data: { status: "REJECTED", completedAt: new Date() },
        include: INSTANCE_INCLUDE,
      });
      return rejected;
    }

    if (decision === "RETURN") {
      await tx.workflowStageInstance.update({ where: { id: stage.id }, data: { status: "PENDING", decidedById: null, decidedAt: null } });
      const returned = await tx.workflowInstance.update({
        where: { id: stage.workflowInstanceId },
        data: { status: "REJECTED", completedAt: new Date() }, // Phase 1: return-for-correction ends the instance; resubmission starts a fresh one.
        include: INSTANCE_INCLUDE,
      });
      return returned;
    }

    // APPROVE
    await tx.workflowStageInstance.update({ where: { id: stage.id }, data: { status: "APPROVED", decidedById: actorId, decidedAt: new Date() } });
    const nextStage = await tx.workflowStageInstance.findFirst({
      where: { workflowInstanceId: stage.workflowInstanceId, sequence: { gt: stage.sequence } },
      orderBy: { sequence: "asc" },
    });
    if (nextStage) {
      await tx.workflowStageInstance.update({ where: { id: nextStage.id }, data: { status: "ACTIVE" } });
      const advanced = await tx.workflowInstance.update({
        where: { id: stage.workflowInstanceId },
        data: { currentStageSequence: nextStage.sequence },
        include: INSTANCE_INCLUDE,
      });
      return advanced;
    }
    // Final stage approved — WF-FR-015: approved, not yet completed. The
    // owning module must call confirmSourceFinalization once it has applied
    // its own business transition.
    const finalized = await tx.workflowInstance.update({
      where: { id: stage.workflowInstanceId },
      data: { status: "SOURCE_FINALIZATION_PENDING" },
      include: INSTANCE_INCLUDE,
    });
    return finalized;
  });

  await logAudit(tenantId, actorId, `WORKFLOW_DECISION_${decision}`, "WorkflowInstance", stage.workflowInstanceId, { stageInstanceId, comment });
  return result;
}

/** Called by the owning source module once it has applied its own state transition. */
export async function confirmSourceFinalization(tenantId: string, actorId: string, instanceId: string) {
  const instance = assertTenant(await db.workflowInstance.findUnique({ where: { id: instanceId } }), tenantId, "WorkflowInstance");
  if (instance.status !== "SOURCE_FINALIZATION_PENDING") {
    throw new Error("Workflow is not awaiting source finalization.");
  }
  const completed = await db.workflowInstance.update({ where: { id: instance.id }, data: { status: "COMPLETED", completedAt: new Date() }, include: INSTANCE_INCLUDE });
  await logAudit(tenantId, actorId, "WORKFLOW_COMPLETED", "WorkflowInstance", instance.id);
  return completed;
}

/**
 * Submitter withdraws their own pending instance, or — WF-FR-055 "no hidden
 * admin bypass" — someone else acting with the workflow.instance.override
 * capability (checked by the caller; see cancelWorkflowAction) force-cancels
 * it. Either way it's the same audited, terminal transition; only the
 * actor's identity relative to the submitter differs.
 */
export async function cancelWorkflow(tenantId: string, actorId: string, instanceId: string, isOverride: boolean) {
  const instance = assertTenant(await db.workflowInstance.findUnique({ where: { id: instanceId } }), tenantId, "WorkflowInstance");
  if (instance.status !== "PENDING") throw new Error("Only a pending workflow can be cancelled.");
  if (instance.submittedById !== actorId && !isOverride) {
    throw new Error("Only the submitter can withdraw this workflow.");
  }
  const cancelled = await db.workflowInstance.update({ where: { id: instance.id }, data: { status: "CANCELLED", completedAt: new Date() }, include: INSTANCE_INCLUDE });
  await logAudit(tenantId, actorId, isOverride ? "WORKFLOW_CANCELLED_OVERRIDE" : "WORKFLOW_CANCELLED", "WorkflowInstance", instance.id);
  return cancelled;
}
