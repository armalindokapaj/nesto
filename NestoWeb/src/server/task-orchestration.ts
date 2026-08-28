import "server-only";
import { db } from "@/lib/db";
import { toPaginatedResult, type PageParams } from "@/lib/pagination";
import { assertTenant, requireTenantMember, requireTenantContract, requireTenantContractor } from "@/lib/tenant";
import {
  DEFAULT_WORKFLOW_STAGES,
  DELIVERABLE_STATUSES_BLOCKING_COMPLETION,
  INSPECTION_RESULTS_REQUIRING_REWORK,
  DEPARTMENT_LABELS,
  type ApprovalAction,
  type ContractLinkDecision,
  type DeliverableStatus,
  type InspectionResult,
} from "@/lib/constants";

// PRD_4 Cross-Department Task Orchestration — the workflow engine.
//
// Every mutating function here does two things atomically: (1) the domain
// mutation, (2) an append-only TaskEvent row (CTO-002/CTO-006/CTO-050 — no
// update/delete path is ever exposed for TaskEvent). Both happen inside a
// single db.$transaction so a caller never observes a state change without
// its corresponding timeline entry, or vice versa.
//
// A Task becomes "orchestrated" the moment startOrchestration() runs; plain
// tasks (simple checklist items, PRD_3 client-comment tasks) never touch any
// of this and keep using Task.status/updateTaskStatus exactly as before.

async function recordEvent(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  taskId: string,
  input: {
    actorId?: string | null;
    actorRole?: string | null;
    eventType: string;
    summary: string;
    previousState?: string | null;
    newState?: string | null;
    metadata?: unknown;
  }
) {
  return tx.taskEvent.create({
    data: {
      tenantId,
      taskId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      eventType: input.eventType,
      summary: input.summary,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      metadata: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
    },
  });
}

async function getOrchestratedTask(tenantId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId }, include: { currentStage: true } });
  return assertTenant(task, tenantId, "Task");
}

// ---------------------------------------------------------------------------
// 6. Workflow engine — orchestration lifecycle
// ---------------------------------------------------------------------------

export async function startOrchestration(
  tenantId: string,
  taskId: string,
  actorId: string,
  input: { taskManagerId: string }
) {
  const task = await getOrchestratedTask(tenantId, taskId);
  if (task.currentStageId) {
    throw new Error("This task is already under orchestration.");
  }
  await requireTenantMember(tenantId, input.taskManagerId);

  return db.$transaction(async (tx) => {
    const stages = await Promise.all(
      DEFAULT_WORKFLOW_STAGES.map((s, index) =>
        tx.taskStage.create({
          data: {
            tenantId,
            taskId,
            key: s.key,
            label: s.label,
            sequence: index + 1,
            status: index === 0 ? "ACTIVE" : "PENDING",
            startedAt: index === 0 ? new Date() : null,
          },
        })
      )
    );

    // §4's Project Management deliverable ("Coordination, decision routing,
    // schedule and final closure") is always active — the coordinator's own
    // accountability, not something that needs an approval gate.
    const pmDepartment = await tx.taskDepartment.create({
      data: {
        tenantId,
        taskId,
        department: "PM",
        ownerId: input.taskManagerId,
        isMandatory: true,
        activatedReason: "Task Manager coordination (always active)",
      },
    });
    await tx.departmentDeliverable.create({
      data: {
        tenantId,
        taskDepartmentId: pmDepartment.id,
        requiredAction: "Coordinate the case through to closure",
        status: "ACTIVE",
        requiresApproval: false,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        taskManagerId: input.taskManagerId,
        orchestrationStatus: "UNDER_TRIAGE",
        currentStageId: stages[0].id,
      },
    });

    await recordEvent(tx, tenantId, taskId, {
      actorId,
      eventType: "ORCHESTRATION_STARTED",
      summary: "Task placed under cross-department orchestration.",
      newState: "UNDER_TRIAGE",
    });

    return stages;
  });
}

const STAGE_TO_ORCHESTRATION_STATUS: Record<string, string> = {
  PM_TRIAGE: "UNDER_TRIAGE",
  ENGINEERING_ASSESSMENT: "ACTIVE",
  REPAIR_CONFIRMED: "ACTIVE",
  PROCUREMENT_ASSESSMENT: "WAITING_FOR_PROCUREMENT",
  LEGAL_ASSESSMENT: "WAITING_FOR_CONTRACT",
  CONTRACTOR_ASSIGNMENT: "WAITING_FOR_CONTRACTOR",
  SITE_EXECUTION: "IN_EXECUTION",
  INSPECTION: "WAITING_FOR_INSPECTION",
  FINAL_VERIFICATION: "UNDER_FINAL_VERIFICATION",
};

// CTO-041 — every transition validates permissions (caller's job), required
// fields and stage ordering before committing. Skipping ahead requires a
// reason and marks the intervening stages SKIPPED rather than silently
// dropping them (§6.1's "authorized stage skipping with reason").
export async function transitionStage(
  tenantId: string,
  taskId: string,
  actorId: string,
  input: { toStageKey: string; reason?: string }
) {
  const task = await getOrchestratedTask(tenantId, taskId);
  if (!task.currentStageId) throw new Error("This task is not under orchestration.");

  const stages = await db.taskStage.findMany({ where: { taskId }, orderBy: { sequence: "asc" } });
  const current = stages.find((s) => s.id === task.currentStageId);
  const target = stages.find((s) => s.key === input.toStageKey);
  if (!current || !target) throw new Error("Unknown stage.");
  if (target.sequence <= current.sequence) {
    throw new Error("Cannot transition backward through transitionStage — use recordInspection's rework loop instead.");
  }

  const skipped = stages.filter((s) => s.sequence > current.sequence && s.sequence < target.sequence && s.status === "PENDING");
  if (skipped.length > 0 && !input.reason) {
    throw new Error(`Skipping ${skipped.map((s) => s.label).join(", ")} requires a reason.`);
  }

  return db.$transaction(async (tx) => {
    await tx.taskStage.update({ where: { id: current.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    for (const s of skipped) {
      await tx.taskStage.update({
        where: { id: s.id },
        data: { status: "SKIPPED", skipReason: input.reason, skippedById: actorId },
      });
    }
    await tx.taskStage.update({ where: { id: target.id }, data: { status: "ACTIVE", startedAt: new Date() } });

    const newOrchestrationStatus = STAGE_TO_ORCHESTRATION_STATUS[target.key] ?? task.orchestrationStatus;
    await tx.task.update({
      where: { id: taskId },
      data: { currentStageId: target.id, orchestrationStatus: newOrchestrationStatus },
    });

    await recordEvent(tx, tenantId, taskId, {
      actorId,
      eventType: "STAGE_TRANSITION",
      summary: skipped.length > 0
        ? `Advanced to ${target.label} (skipped ${skipped.map((s) => s.label).join(", ")}: ${input.reason}).`
        : `Advanced to ${target.label}.`,
      previousState: current.key,
      newState: target.key,
    });

    return tx.taskStage.findMany({ where: { taskId }, orderBy: { sequence: "asc" } });
  });
}

// ---------------------------------------------------------------------------
// 4/5. Department involvement and deliverables
// ---------------------------------------------------------------------------

export async function activateDepartment(
  tenantId: string,
  taskId: string,
  actorId: string,
  input: {
    department: string;
    ownerId: string;
    requiredAction: string;
    expectedOutput?: string;
    deadline?: Date;
    isMandatory?: boolean;
    requiresApproval?: boolean;
    activatedReason?: string;
  }
) {
  await getOrchestratedTask(tenantId, taskId);
  await requireTenantMember(tenantId, input.ownerId);

  return db.$transaction(async (tx) => {
    const department = await tx.taskDepartment.create({
      data: {
        tenantId,
        taskId,
        department: input.department,
        ownerId: input.ownerId,
        isMandatory: input.isMandatory ?? true,
        activatedReason: input.activatedReason,
      },
    });
    const deliverable = await tx.departmentDeliverable.create({
      data: {
        tenantId,
        taskDepartmentId: department.id,
        requiredAction: input.requiredAction,
        expectedOutput: input.expectedOutput,
        deadline: input.deadline,
        status: "ACTIVE",
        requiresApproval: input.requiresApproval ?? true,
      },
    });

    await tx.notification.create({
      data: {
        tenantId,
        userId: input.ownerId,
        type: "DEPARTMENT_DELIVERABLE_ASSIGNED",
        title: "Department deliverable assigned",
        body: `${DEPARTMENT_LABELS[input.department as keyof typeof DEPARTMENT_LABELS] ?? input.department}: ${input.requiredAction}`,
        link: `/tasks/${taskId}`,
      },
    });

    await recordEvent(tx, tenantId, taskId, {
      actorId,
      eventType: "DEPARTMENT_ACTIVATED",
      summary: `${input.department} activated (${input.activatedReason ?? "manual"}): ${input.requiredAction}`,
      newState: "ACTIVE",
    });

    return { department, deliverable };
  });
}

export async function requestDepartmentInvolvement(
  tenantId: string,
  taskId: string,
  requestedById: string,
  input: { department: string; reason: string; requestedAction?: string; desiredDeadline?: Date; shouldBlock?: boolean }
) {
  await getOrchestratedTask(tenantId, taskId);

  return db.$transaction(async (tx) => {
    const request = await tx.departmentInvolvementRequest.create({
      data: {
        tenantId,
        taskId,
        requestedById,
        department: input.department,
        reason: input.reason,
        requestedAction: input.requestedAction,
        desiredDeadline: input.desiredDeadline,
        shouldBlock: input.shouldBlock ?? true,
      },
    });

    const departmentMembers = await tx.companyMembership.findMany({
      where: { tenantId, role: input.department },
      select: { userId: true },
    });
    if (departmentMembers.length > 0) {
      await tx.notification.createMany({
        data: departmentMembers.map((m) => ({
          tenantId,
          userId: m.userId,
          type: "DEPARTMENT_INVOLVEMENT_REQUEST",
          title: "Department involvement requested",
          body: input.reason,
          link: `/tasks/${taskId}`,
        })),
      });
    }

    await recordEvent(tx, tenantId, taskId, {
      actorId: requestedById,
      eventType: "DEPARTMENT_ACTIVATED",
      summary: `Requested ${input.department} involvement: ${input.reason}`,
    });

    return request;
  });
}

export async function respondToInvolvementRequest(
  tenantId: string,
  requestId: string,
  respondedById: string,
  input: {
    status: "ACTION_REQUIRED" | "COMMENT_ONLY" | "NOT_REQUIRED" | "INFO_REQUESTED" | "REDIRECTED";
    response?: string;
    redirectDepartment?: string;
    ownerId?: string;
    requiredAction?: string;
  }
) {
  const request = assertTenant(
    await db.departmentInvolvementRequest.findUnique({ where: { id: requestId } }),
    tenantId,
    "DepartmentInvolvementRequest"
  );

  await db.departmentInvolvementRequest.update({
    where: { id: requestId },
    data: { status: input.status, response: input.response, redirectDepartment: input.redirectDepartment, respondedById, respondedAt: new Date() },
  });

  if (input.status === "ACTION_REQUIRED") {
    if (!input.ownerId || !input.requiredAction) {
      throw new Error("An accountable owner and required action are needed to activate this department.");
    }
    await activateDepartment(tenantId, request.taskId, respondedById, {
      department: request.department,
      ownerId: input.ownerId,
      requiredAction: input.requiredAction,
      activatedReason: `Involvement request: ${request.reason}`,
    });
  } else {
    await db.taskEvent.create({
      data: {
        tenantId,
        taskId: request.taskId,
        actorId: respondedById,
        eventType: "DEPARTMENT_ACTIVATED",
        summary: `${request.department} involvement request resolved: ${input.status}${input.response ? ` — ${input.response}` : ""}`,
      },
    });
  }

  return db.departmentInvolvementRequest.findUnique({ where: { id: requestId } });
}

export async function submitDeliverable(tenantId: string, deliverableId: string, actorId: string) {
  const deliverable = await db.departmentDeliverable.findUnique({
    where: { id: deliverableId },
    include: { taskDepartment: true },
  });
  if (!deliverable || deliverable.tenantId !== tenantId) throw new Error("Deliverable not found.");

  const nextStatus: DeliverableStatus = deliverable.requiresApproval ? "SUBMITTED" : "COMPLETED";

  return db.$transaction(async (tx) => {
    await tx.departmentDeliverable.update({
      where: { id: deliverableId },
      data: { status: nextStatus, submittedAt: new Date(), ...(nextStatus === "COMPLETED" ? { approvedAt: new Date() } : {}) },
    });
    await recordEvent(tx, tenantId, deliverable.taskDepartment.taskId, {
      actorId,
      actorRole: deliverable.taskDepartment.department,
      eventType: "DELIVERABLE_SUBMITTED",
      summary: `${deliverable.taskDepartment.department} submitted: ${deliverable.requiredAction}`,
      newState: nextStatus,
    });
    return tx.departmentDeliverable.findUnique({ where: { id: deliverableId } });
  });
}

export async function markNotRequired(
  tenantId: string,
  deliverableId: string,
  actorId: string,
  reason: string
) {
  const deliverable = await db.departmentDeliverable.findUnique({ where: { id: deliverableId }, include: { taskDepartment: true } });
  if (!deliverable || deliverable.tenantId !== tenantId) throw new Error("Deliverable not found.");

  return db.$transaction(async (tx) => {
    await tx.departmentDeliverable.update({ where: { id: deliverableId }, data: { status: "NOT_REQUIRED", notRequiredReason: reason } });
    await recordEvent(tx, tenantId, deliverable.taskDepartment.taskId, {
      actorId,
      eventType: "DELIVERABLE_SUBMITTED",
      summary: `${deliverable.taskDepartment.department} marked not required: ${reason}`,
      newState: "NOT_REQUIRED",
    });
  });
}

// ---------------------------------------------------------------------------
// 8.4 Formal approvals (CTO-061 — never a plain comment)
// ---------------------------------------------------------------------------

export async function recordApproval(
  tenantId: string,
  taskId: string,
  approverId: string,
  input: {
    deliverableId?: string;
    action: ApprovalAction;
    comment?: string;
    conditions?: string[];
    delegatedToId?: string;
  }
) {
  await getOrchestratedTask(tenantId, taskId);
  if (input.action === "APPROVE_WITH_CONDITIONS" && (!input.conditions || input.conditions.length === 0)) {
    throw new Error("Approving with conditions requires at least one explicit condition.");
  }
  if (input.action === "DELEGATE" && !input.delegatedToId) {
    throw new Error("Delegating requires the user to delegate to.");
  }
  if (input.delegatedToId) await requireTenantMember(tenantId, input.delegatedToId);

  return db.$transaction(async (tx) => {
    const approval = await tx.taskApproval.create({
      data: {
        tenantId,
        taskId,
        deliverableId: input.deliverableId,
        approverId,
        action: input.action,
        comment: input.comment,
        conditions: input.conditions ? JSON.stringify(input.conditions) : null,
        conditionsMet: input.action !== "APPROVE_WITH_CONDITIONS",
        delegatedToId: input.delegatedToId,
      },
    });

    if (input.deliverableId) {
      const statusByAction: Partial<Record<ApprovalAction, DeliverableStatus>> = {
        APPROVE: "APPROVED",
        APPROVE_WITH_CONDITIONS: "APPROVED",
        REJECT: "REJECTED",
        REQUEST_REVISION: "REVISION_REQUIRED",
        REQUEST_INFO: "INFORMATION_REQUESTED",
      };
      const nextStatus = statusByAction[input.action];
      if (nextStatus) {
        await tx.departmentDeliverable.update({
          where: { id: input.deliverableId },
          data: { status: nextStatus, ...(nextStatus === "APPROVED" ? { approvedAt: new Date() } : {}) },
        });
        if (nextStatus === "APPROVED") {
          const dependents = await tx.departmentDeliverable.findMany({ where: { blockedByDeliverableId: input.deliverableId } });
          for (const dep of dependents) {
            if (dep.status === "WAITING_FOR_DEPENDENCY") {
              await tx.departmentDeliverable.update({ where: { id: dep.id }, data: { status: "ACTIVE" } });
            }
          }
        }
      }
    }

    await recordEvent(tx, tenantId, taskId, {
      actorId: approverId,
      eventType: "APPROVAL_RECORDED",
      summary: `Approval action: ${input.action}${input.comment ? ` — ${input.comment}` : ""}`,
      newState: input.action,
    });

    return approval;
  });
}

export async function markConditionsMet(tenantId: string, approvalId: string, actorId: string) {
  const approval = assertTenant(await db.taskApproval.findUnique({ where: { id: approvalId } }), tenantId, "TaskApproval");
  return db.$transaction(async (tx) => {
    await tx.taskApproval.update({ where: { id: approvalId }, data: { conditionsMet: true } });
    await recordEvent(tx, tenantId, approval.taskId, {
      actorId,
      eventType: "APPROVAL_RECORDED",
      summary: "Approval conditions satisfied.",
    });
  });
}

// ---------------------------------------------------------------------------
// 9. Contract and procurement integration
// ---------------------------------------------------------------------------

export async function linkContract(
  tenantId: string,
  taskId: string,
  createdById: string,
  input: { decision: ContractLinkDecision; contractId?: string; reason?: string }
) {
  await getOrchestratedTask(tenantId, taskId);
  if (input.contractId) await requireTenantContract(tenantId, input.contractId);

  return db.$transaction(async (tx) => {
    const link = await tx.taskContractLink.create({
      data: { tenantId, taskId, decision: input.decision, contractId: input.contractId, reason: input.reason, createdById },
    });
    await recordEvent(tx, tenantId, taskId, {
      actorId: createdById,
      eventType: "CONTRACT_LINKED",
      summary: `Legal decision: ${input.decision}${input.reason ? ` — ${input.reason}` : ""}`,
      newState: input.decision,
    });
    return link;
  });
}

// CTO-070 — contractor execution can't be authorized until the contract gate
// passes, when the active routing decision requires one.
export async function contractGatePassed(tenantId: string, taskId: string): Promise<boolean> {
  const links = await db.taskContractLink.findMany({
    where: { tenantId, taskId },
    include: { contract: true },
    orderBy: { createdAt: "desc" },
  });
  if (links.length === 0) return true; // no legal assessment recorded yet = gate not yet relevant
  const latest = links[0];
  if (latest.decision === "NOT_REQUIRED" || latest.decision === "EXISTING_CONTRACT") return true;
  if (latest.decision === "FURTHER_ASSESSMENT") return false;
  // VARIATION_REQUIRED / NEW_CONTRACT_REQUIRED — gate passes once the linked
  // contract exists and is active.
  return latest.contract?.status === "ACTIVE";
}

// ---------------------------------------------------------------------------
// 10. Contractor execution
// ---------------------------------------------------------------------------

export async function assignContractor(
  tenantId: string,
  taskId: string,
  assignedById: string,
  input: { contractorId: string; contractId?: string; scope: string; plannedStart?: Date; deadline?: Date }
) {
  await getOrchestratedTask(tenantId, taskId);
  if (!(await contractGatePassed(tenantId, taskId))) {
    throw new Error("The contract gate has not passed yet — contractor execution cannot be authorized.");
  }
  await Promise.all([
    requireTenantContractor(tenantId, input.contractorId),
    input.contractId ? requireTenantContract(tenantId, input.contractId) : null,
  ]);

  return db.$transaction(async (tx) => {
    const assignment = await tx.taskContractorAssignment.create({
      data: {
        tenantId,
        taskId,
        contractorId: input.contractorId,
        contractId: input.contractId,
        scope: input.scope,
        plannedStart: input.plannedStart,
        deadline: input.deadline,
        assignedById,
      },
    });

    const contractor = await tx.contractor.findUnique({ where: { id: input.contractorId } });
    if (contractor?.userId) {
      await tx.notification.create({
        data: {
          tenantId,
          userId: contractor.userId,
          type: "CONTRACTOR_ASSIGNMENT",
          title: "New work package assigned",
          body: input.scope,
          link: `/dashboard/contractor`,
        },
      });
    }

    await recordEvent(tx, tenantId, taskId, {
      actorId: assignedById,
      eventType: "CONTRACTOR_ASSIGNED",
      summary: `Contractor assigned: ${input.scope}`,
      newState: "ASSIGNED",
    });

    return assignment;
  });
}

export const CONTRACTOR_ACTIONS = [
  "ACCEPT",
  "REQUEST_CLARIFICATION",
  "CONFIRM_START",
  "REPORT_DELAY",
  "REPORT_READY_FOR_INSPECTION",
] as const;
export type ContractorActionType = (typeof CONTRACTOR_ACTIONS)[number];

// §9's completion boundary: this list of actions is exhaustive and never
// includes "complete the task" — a contractor is structurally unable to
// close a parent task, not merely blocked by a permission check.
export async function contractorAction(
  tenantId: string,
  assignmentId: string,
  actorId: string,
  action: ContractorActionType,
  message?: string
) {
  const assignment = assertTenant(
    await db.taskContractorAssignment.findUnique({ where: { id: assignmentId } }),
    tenantId,
    "TaskContractorAssignment"
  );

  const statusByAction: Record<ContractorActionType, string> = {
    ACCEPT: "ACCEPTED",
    REQUEST_CLARIFICATION: "CLARIFICATION_REQUESTED",
    CONFIRM_START: "IN_PROGRESS",
    REPORT_DELAY: "DELAYED",
    REPORT_READY_FOR_INSPECTION: "READY_FOR_INSPECTION",
  };
  const nextStatus = statusByAction[action];

  return db.$transaction(async (tx) => {
    await tx.taskContractorAssignment.update({
      where: { id: assignmentId },
      data: {
        status: nextStatus,
        ...(action === "ACCEPT" ? { acceptedAt: new Date() } : {}),
        ...(action === "REPORT_READY_FOR_INSPECTION" ? { readyForInspectionAt: new Date() } : {}),
      },
    });

    if (action === "REPORT_READY_FOR_INSPECTION") {
      await tx.taskInspection.create({ data: { tenantId, taskId: assignment.taskId } });
      await tx.task.update({ where: { id: assignment.taskId }, data: { orchestrationStatus: "WAITING_FOR_INSPECTION" } });
    }

    await recordEvent(tx, tenantId, assignment.taskId, {
      actorId,
      actorRole: "CONTRACTOR",
      eventType: "CONTRACTOR_ACTION",
      summary: `Contractor: ${action}${message ? ` — ${message}` : ""}`,
      newState: nextStatus,
    });

    return tx.taskContractorAssignment.findUnique({ where: { id: assignmentId } });
  });
}

// ---------------------------------------------------------------------------
// 11. Inspection, completion and reopening
// ---------------------------------------------------------------------------

// CTO-080 — a failed/rework result returns the workflow to contractor
// execution while the failed inspection record itself stays immutable; a
// fresh TaskInspection row is created the next time the contractor reports
// ready, so the full inspection history remains visible.
export async function recordInspection(
  tenantId: string,
  taskId: string,
  inspectorId: string,
  input: { inspectionId?: string; result: InspectionResult; notes?: string }
) {
  await getOrchestratedTask(tenantId, taskId);

  const inspection = input.inspectionId
    ? assertTenant(await db.taskInspection.findUnique({ where: { id: input.inspectionId } }), tenantId, "TaskInspection")
    : await db.taskInspection.create({ data: { tenantId, taskId } });

  return db.$transaction(async (tx) => {
    await tx.taskInspection.update({
      where: { id: inspection.id },
      data: { inspectorId, result: input.result, notes: input.notes, inspectedAt: new Date() },
    });

    const requiresRework = INSPECTION_RESULTS_REQUIRING_REWORK.includes(input.result);
    if (requiresRework) {
      const assignment = await tx.taskContractorAssignment.findFirst({ where: { taskId }, orderBy: { createdAt: "desc" } });
      if (assignment) {
        await tx.taskContractorAssignment.update({ where: { id: assignment.id }, data: { status: "REWORK_REQUIRED" } });
      }
      const executionStage = await tx.taskStage.findFirst({ where: { taskId, key: "SITE_EXECUTION" } });
      if (executionStage) {
        await tx.taskStage.update({ where: { id: executionStage.id }, data: { status: "ACTIVE", completedAt: null } });
        await tx.task.update({ where: { id: taskId }, data: { currentStageId: executionStage.id, orchestrationStatus: "IN_EXECUTION" } });
      }
    } else if (input.result === "PASSED" || input.result === "PASSED_WITH_OBSERVATIONS") {
      const assignment = await tx.taskContractorAssignment.findFirst({ where: { taskId }, orderBy: { createdAt: "desc" } });
      if (assignment) {
        await tx.taskContractorAssignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED" } });
      }
      const verificationStage = await tx.taskStage.findFirst({ where: { taskId, key: "FINAL_VERIFICATION" } });
      if (verificationStage) {
        const executionStage = await tx.taskStage.findFirst({ where: { taskId, key: "SITE_EXECUTION" } });
        if (executionStage && executionStage.status !== "COMPLETED") {
          await tx.taskStage.update({ where: { id: executionStage.id }, data: { status: "COMPLETED", completedAt: new Date() } });
        }
        const inspectionStage = await tx.taskStage.findFirst({ where: { taskId, key: "INSPECTION" } });
        if (inspectionStage) await tx.taskStage.update({ where: { id: inspectionStage.id }, data: { status: "COMPLETED", completedAt: new Date() } });
        await tx.taskStage.update({ where: { id: verificationStage.id }, data: { status: "ACTIVE", startedAt: new Date() } });
        await tx.task.update({ where: { id: taskId }, data: { currentStageId: verificationStage.id, orchestrationStatus: "UNDER_FINAL_VERIFICATION" } });
      }
    }

    await recordEvent(tx, tenantId, taskId, {
      actorId: inspectorId,
      eventType: "INSPECTION_RECORDED",
      summary: `Inspection result: ${input.result}${input.notes ? ` — ${input.notes}` : ""}`,
      newState: input.result,
    });

    return tx.taskInspection.findUnique({ where: { id: inspection.id } });
  });
}

type CompletionGateStatus = { canComplete: boolean; blockers: string[] };

export async function getCompletionGateStatus(tenantId: string, taskId: string): Promise<CompletionGateStatus> {
  const task = await getOrchestratedTask(tenantId, taskId);
  if (!task.currentStageId) {
    return { canComplete: false, blockers: ["This task is not under orchestration."] };
  }

  // Six independent reads. They used to run one after another, which on a
  // remote database is six times the round-trip latency for no reason — none
  // of them depends on another's result. The blockers are still assembled in
  // a fixed order below, so the message list a user sees is unchanged.
  const [stages, departments, contractGateOk, assignments, inspections, openApprovals] = await Promise.all([
    db.taskStage.findMany({ where: { taskId } }),
    db.taskDepartment.findMany({ where: { taskId, isMandatory: true }, include: { deliverable: true } }),
    contractGatePassed(tenantId, taskId),
    db.taskContractorAssignment.findMany({ where: { taskId } }),
    db.taskInspection.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
    db.taskApproval.findMany({ where: { taskId, action: "APPROVE_WITH_CONDITIONS", conditionsMet: false } }),
  ]);

  const blockers: string[] = [];

  // FINAL_VERIFICATION is the terminal stage completeTask() itself resolves
  // (same for the PM department's own always-on coordination deliverable
  // below) — neither can be "done" before completion without a chicken-and-
  // egg deadlock, so both are excluded from blocking the gate they satisfy.
  const openStages = stages.filter(
    (s) => s.key !== "FINAL_VERIFICATION" && (s.status === "PENDING" || s.status === "ACTIVE" || s.status === "WAITING" || s.status === "REJECTED")
  );
  for (const s of openStages) blockers.push(`Stage not resolved: ${s.label}`);

  for (const d of departments) {
    if (d.department === "PM") continue;
    const status = d.deliverable?.status as DeliverableStatus | undefined;
    if (status && DELIVERABLE_STATUSES_BLOCKING_COMPLETION.includes(status)) {
      blockers.push(`${d.department} deliverable not resolved: ${d.deliverable?.requiredAction}`);
    }
  }

  if (!contractGateOk) {
    blockers.push("Contract gate not passed.");
  }

  for (const a of assignments) {
    if (a.status !== "COMPLETED") blockers.push(`Contractor work not complete: ${a.scope}`);
  }

  if (inspections.length > 0) {
    const latest = inspections[0];
    if (!latest.result || latest.result === "FAILED" || latest.result === "REWORK_REQUIRED" || latest.result === "ADDITIONAL_INSPECTION_REQUIRED") {
      blockers.push("Inspection has not passed.");
    }
  }

  for (const a of openApprovals) blockers.push(`Approval conditions not yet satisfied (approval ${a.id.slice(-6)}).`);

  return { canComplete: blockers.length === 0, blockers };
}

// CTO-081 — only after the backend validates every gate; rejects with the
// full blocker list otherwise (§18.2 "Unauthorized completion" scenario).
export async function completeTask(
  tenantId: string,
  taskId: string,
  completedById: string,
  input: { comment: string; actualDate?: Date }
) {
  const gate = await getCompletionGateStatus(tenantId, taskId);
  if (!gate.canComplete) {
    const err = new Error(`Cannot complete task — outstanding gates: ${gate.blockers.join("; ")}`);
    (err as Error & { blockers?: string[] }).blockers = gate.blockers;
    throw err;
  }

  return db.$transaction(async (tx) => {
    const record = await tx.taskCompletionRecord.create({
      data: {
        tenantId,
        taskId,
        completedById,
        comment: input.comment,
        actualDate: input.actualDate ?? new Date(),
        gatesSnapshot: JSON.stringify(gate),
      },
    });

    const finalStage = await tx.taskStage.findFirst({ where: { taskId, key: "FINAL_VERIFICATION" } });
    if (finalStage && finalStage.status !== "COMPLETED") {
      await tx.taskStage.update({ where: { id: finalStage.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    }
    const pmDeliverable = await tx.departmentDeliverable.findFirst({ where: { taskDepartment: { taskId, department: "PM" } } });
    if (pmDeliverable && pmDeliverable.status !== "COMPLETED") {
      await tx.departmentDeliverable.update({ where: { id: pmDeliverable.id }, data: { status: "COMPLETED", approvedAt: new Date() } });
    }

    await tx.task.update({
      where: { id: taskId },
      data: { orchestrationStatus: "COMPLETED", actualCompletionDate: input.actualDate ?? new Date() },
    });

    await recordEvent(tx, tenantId, taskId, {
      actorId: completedById,
      eventType: "TASK_COMPLETED",
      summary: `Task completed: ${input.comment}`,
      newState: "COMPLETED",
    });

    return record;
  });
}

// CTO-082 — reopening starts a new lifecycle segment; the prior completion
// record is never modified.
export async function reopenTask(
  tenantId: string,
  taskId: string,
  reopenedById: string,
  input: { reason: string; newIssue?: string; newDeadline?: Date; riskImpact?: string; reopenedStageKey?: string }
) {
  const task = await getOrchestratedTask(tenantId, taskId);
  if (task.orchestrationStatus !== "COMPLETED") {
    throw new Error("Only a completed task can be reopened.");
  }
  const previousCompletion = await db.taskCompletionRecord.findFirst({ where: { taskId }, orderBy: { createdAt: "desc" } });
  if (!previousCompletion) throw new Error("No prior completion record found.");

  return db.$transaction(async (tx) => {
    const record = await tx.taskReopeningRecord.create({
      data: {
        tenantId,
        taskId,
        reopenedById,
        reason: input.reason,
        newIssue: input.newIssue,
        newDeadline: input.newDeadline,
        riskImpact: input.riskImpact,
        previousCompletionRecordId: previousCompletion.id,
      },
    });

    const reopenStage = input.reopenedStageKey
      ? await tx.taskStage.findFirst({ where: { taskId, key: input.reopenedStageKey } })
      : await tx.taskStage.findFirst({ where: { taskId, key: "SITE_EXECUTION" } });

    await tx.task.update({
      where: { id: taskId },
      data: {
        orchestrationStatus: "REOPENED",
        actualCompletionDate: null,
        ...(reopenStage ? { currentStageId: reopenStage.id } : {}),
      },
    });
    if (reopenStage) {
      await tx.taskStage.update({ where: { id: reopenStage.id }, data: { status: "ACTIVE", completedAt: null, startedAt: new Date() } });
    }

    await recordEvent(tx, tenantId, taskId, {
      actorId: reopenedById,
      eventType: "TASK_REOPENED",
      summary: `Task reopened: ${input.reason}`,
      newState: "REOPENED",
    });

    return record;
  });
}

// ---------------------------------------------------------------------------
// 12. Delay, escalation
// ---------------------------------------------------------------------------

export async function explainDelay(
  tenantId: string,
  taskId: string,
  authorId: string,
  input: {
    deliverableId?: string;
    cause: string;
    progressPct: number;
    newExpectedDate: Date;
    blockingDependency?: string;
    costImpact?: number;
    scheduleImpactDays?: number;
    correctiveAction?: string;
  }
) {
  await getOrchestratedTask(tenantId, taskId);

  return db.$transaction(async (tx) => {
    const explanation = await tx.taskDelayExplanation.create({
      data: {
        tenantId,
        taskId,
        deliverableId: input.deliverableId,
        cause: input.cause,
        progressPct: input.progressPct,
        newExpectedDate: input.newExpectedDate,
        blockingDependency: input.blockingDependency,
        costImpact: input.costImpact,
        scheduleImpactDays: input.scheduleImpactDays,
        correctiveAction: input.correctiveAction,
        authorId,
      },
    });
    await recordEvent(tx, tenantId, taskId, {
      actorId: authorId,
      eventType: "DELAY_EXPLAINED",
      summary: `Delay explained: ${input.cause} (now ${input.progressPct}% — new date ${input.newExpectedDate.toDateString()})`,
    });
    return explanation;
  });
}

// §12.2's chain runs through the task's own Task Manager first; escalate()
// is a manual action (Task Manager/PM/CEO-triggered) rather than time-based —
// this app has no background scheduler to fire escalations automatically.
export async function escalate(
  tenantId: string,
  taskId: string,
  fromUserId: string | null,
  toUserId: string,
  reason: string
) {
  await getOrchestratedTask(tenantId, taskId);
  await requireTenantMember(tenantId, toUserId);

  return db.$transaction(async (tx) => {
    const escalation = await tx.taskEscalation.create({
      data: { tenantId, taskId, fromUserId, toUserId, reason },
    });
    await tx.notification.create({
      data: { tenantId, userId: toUserId, type: "TASK_ESCALATION", title: "Task escalated to you", body: reason, link: `/tasks/${taskId}` },
    });
    await recordEvent(tx, tenantId, taskId, {
      actorId: fromUserId,
      eventType: "ESCALATED",
      summary: `Escalated: ${reason}`,
    });
    return escalation;
  });
}

export async function acknowledgeEscalation(tenantId: string, escalationId: string, actorId: string) {
  const escalation = assertTenant(await db.taskEscalation.findUnique({ where: { id: escalationId } }), tenantId, "TaskEscalation");
  return db.$transaction(async (tx) => {
    await tx.taskEscalation.update({ where: { id: escalationId }, data: { acknowledgedAt: new Date() } });
    await recordEvent(tx, tenantId, escalation.taskId, {
      actorId,
      eventType: "ESCALATION_ACKNOWLEDGED",
      summary: "Escalation acknowledged.",
    });
  });
}

// ---------------------------------------------------------------------------
// 13. Read models — task detail, CEO summary, contractor work package
// ---------------------------------------------------------------------------

export async function getTaskOrchestration(tenantId: string, taskId: string) {
  const task = await db.task.findUnique({
    // One SQL statement with lateral joins instead of one round-trip per
    // relation. There are ~16 relations below, and Prisma's default strategy
    // issues a separate query for each — against a remote database that is
    // ~16 x the network latency before any work happens, and this view
    // re-renders inside every server action performed on the task.
    relationLoadStrategy: "join",
    where: { id: taskId },
    include: {
      project: true,
      client: true,
      createdBy: true,
      mainResponsible: true,
      taskManager: true,
      decisionOwner: true,
      finalApprover: true,
      currentStage: true,
      stages: { orderBy: { sequence: "asc" } },
      departments: { include: { owner: true, deliverable: true } },
      participants: { include: { user: true } },
      contributions: { select: { userId: true } },
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      approvals: { include: { approver: true, delegatedTo: true }, orderBy: { createdAt: "desc" } },
      involvementRequests: { include: { requestedBy: true, respondedBy: true }, orderBy: { createdAt: "desc" } },
      escalations: { include: { fromUser: true, toUser: true }, orderBy: { createdAt: "desc" } },
      delayExplanations: { include: { author: true }, orderBy: { createdAt: "desc" } },
      contractLinks: { include: { contract: true, createdBy: true }, orderBy: { createdAt: "desc" } },
      contractorAssignments: { include: { contractor: true, contract: true, assignedBy: true }, orderBy: { createdAt: "desc" } },
      inspections: { include: { inspector: true }, orderBy: { createdAt: "desc" } },
      completionRecords: { include: { completedBy: true }, orderBy: { createdAt: "desc" } },
      reopeningRecords: { include: { reopenedBy: true }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  return assertTenant(task, tenantId, "Task");
}

export type TaskOrchestrationData = Awaited<ReturnType<typeof getTaskOrchestration>>;

export type CeoTaskSummaryRow = Awaited<ReturnType<typeof getCeoOrchestrationSummary>>[number];

const CEO_SUMMARY_INCLUDE = {
  currentStage: true,
  taskManager: true,
  project: true,
  departments: { include: { owner: true, deliverable: true } },
  contractorAssignments: { include: { contractor: true } },
  contractLinks: { include: { contract: true }, orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

function ceoSummaryWhere(tenantId: string) {
  return { tenantId, currentStageId: { not: null } };
}

/**
 * Paginated sibling — Phase 4 Priority 2. This one matters more than its row
 * count suggests: every row pulls six relations, so the cost of the page grows
 * with tasks × relations, not with tasks.
 */
export async function getCeoOrchestrationSummaryPage(tenantId: string, params: PageParams) {
  const where = ceoSummaryWhere(tenantId);
  const [tasks, total] = await Promise.all([
    db.task.findMany({ where, include: CEO_SUMMARY_INCLUDE, orderBy: { createdAt: "desc" }, skip: params.skip, take: params.take }),
    db.task.count({ where }),
  ]);
  return toPaginatedResult(summariseCeoTasks(tasks), total, params);
}

export async function getCeoOrchestrationSummary(tenantId: string) {
  const tasks = await db.task.findMany({
    where: ceoSummaryWhere(tenantId),
    include: CEO_SUMMARY_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return summariseCeoTasks(tasks);
}

type CeoSummaryTask = Awaited<ReturnType<typeof db.task.findMany<{ where: { tenantId: string }; include: typeof CEO_SUMMARY_INCLUDE }>>>[number];

function summariseCeoTasks(tasks: CeoSummaryTask[]) {
  const now = Date.now();
  return tasks.map((task) => {
    const ageDays = Math.floor((now - task.createdAt.getTime()) / 86_400_000);
    const overdueDays = task.dueDate && task.orchestrationStatus !== "COMPLETED" && task.dueDate.getTime() < now
      ? Math.floor((now - task.dueDate.getTime()) / 86_400_000)
      : 0;
    const blockingDeliverable = task.departments.find(
      (d) => d.deliverable && DELIVERABLE_STATUSES_BLOCKING_COMPLETION.includes(d.deliverable.status as DeliverableStatus)
    );
    const contractValueMinor = task.contractLinks[0]?.contract?.valueMinor ?? null;

    return {
      task,
      ageDays,
      overdueDays,
      blocker: blockingDeliverable ? `${blockingDeliverable.department}: ${blockingDeliverable.deliverable?.requiredAction}` : null,
      nextResponsible: blockingDeliverable?.owner ?? task.taskManager,
      forecast: task.forecastDate ?? task.dueDate,
      commercialImpactMinor: contractValueMinor,
    };
  });
}

export async function getContractorWorkPackages(tenantId: string, userId: string) {
  const contractor = await db.contractor.findFirst({ where: { tenantId, userId } });
  if (!contractor) return [];

  // CTO-100 — task-scoped fields only: no project/client/finance objects,
  // just what's needed to execute and document the assignment (§10).
  const assignments = await db.taskContractorAssignment.findMany({
    where: { tenantId, contractorId: contractor.id },
    include: {
      contract: { select: { id: true, number: true, title: true, status: true } },
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          locationDetail: true,
          dueDate: true,
          documents: { where: { category: "SAFETY_DOCUMENT" }, select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return assignments;
}
