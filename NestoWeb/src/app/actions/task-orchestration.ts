"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { createTaskComment } from "@/server/comments";
import {
  DEPARTMENT_ROLES,
  APPROVAL_ACTIONS,
  CONTRACT_LINK_DECISIONS,
  INSPECTION_RESULTS,
} from "@/lib/constants";
import type { Role } from "@/lib/constants";
import {
  startOrchestration,
  transitionStage,
  activateDepartment,
  requestDepartmentInvolvement,
  respondToInvolvementRequest,
  submitDeliverable,
  markNotRequired,
  recordApproval,
  markConditionsMet,
  linkContract,
  assignContractor,
  contractorAction,
  CONTRACTOR_ACTIONS,
  recordInspection,
  completeTask,
  reopenTask,
  explainDelay,
  escalate,
  acknowledgeEscalation,
} from "@/server/task-orchestration";
import { toActionError } from "@/lib/errors";

export type ActionState = { error: string } | undefined;

const CreateTaskCommentSchema = z.object({ taskId: z.string().min(1), body: z.string().min(1) });
export async function createTaskCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) return { error: "You do not have permission to comment on this task." };
  const parsed = CreateTaskCommentSchema.safeParse({ taskId: formData.get("taskId"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createTaskComment(tenantId, user.id, parsed.data.taskId, parsed.data.body);
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return undefined;
}

// Coordination actions (starting orchestration, advancing stages,
// completing/reopening the task) require at least TASKS:WRITE — matches
// §3's Task Manager/PM authority, and this company-wide role level lines up
// with who's actually allowed to hold that job.
async function requireTaskWriter() {
  const session = await getCurrentUser();
  if (!can(session.role, "TASKS", "WRITE")) {
    throw new Error("You do not have permission to manage this task's workflow.");
  }
  return session;
}

// Department-level participation (submitting/approving a deliverable,
// recording a legal decision, assigning a contractor, inspecting, explaining
// a delay) only needs TASKS:READ as a floor. §14's table gives Finance/Legal/
// Procurement/Stock department managers real authority over their own
// deliverable even though their company-wide Tasks-module access is
// read-only — the deliverable ownership / role-specific check that follows
// each call below is the real gate, not this floor.
async function requireTaskParticipant() {
  const session = await getCurrentUser();
  if (!can(session.role, "TASKS", "READ")) {
    throw new Error("You do not have permission to act on this task.");
  }
  return session;
}

async function requireTask(tenantId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  return assertTenant(task, tenantId, "Task");
}

// Audit C7 — the task's own named authorities (whoever runs it or makes its
// calls) plus company-wide Owner/Admin oversight. Used as the override tier
// for actions that are otherwise scoped to a specific department/approver/
// addressee, so leadership is never locked out of their own task.
async function isTaskLevelAuthority(tenantId: string, taskId: string, userId: string, role: Role) {
  if (can(role, "USER_MANAGEMENT", "FULL")) return true;
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { tenantId: true, taskManagerId: true, decisionOwnerId: true, finalApproverId: true },
  });
  if (!task || task.tenantId !== tenantId) throw new Error("Task not found.");
  return task.taskManagerId === userId || task.decisionOwnerId === userId || task.finalApproverId === userId;
}

function toError(err: unknown): ActionState {
  return { error: toActionError(err, "Something went wrong.") };
}

const StartOrchestrationSchema = z.object({ taskId: z.string().min(1), taskManagerId: z.string().min(1) });
export async function startOrchestrationAction(input: z.infer<typeof StartOrchestrationSchema>): Promise<ActionState> {
  try {
    const { tenantId, user } = await requireTaskWriter();
    const parsed = StartOrchestrationSchema.parse(input);
    await startOrchestration(tenantId, parsed.taskId, user.id, { taskManagerId: parsed.taskManagerId });
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const TransitionStageSchema = z.object({ taskId: z.string().min(1), toStageKey: z.string().min(1), reason: z.string().optional() });
export async function transitionStageAction(input: z.infer<typeof TransitionStageSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskWriter();
    const parsed = TransitionStageSchema.parse(input);
    const task = await requireTask(tenantId, parsed.taskId);
    // Only the task's coordinator (or company leadership) drives stage
    // transitions — matches §3's "Task Manager: Assign stages... " authority.
    const isCoordinator = task.taskManagerId === user.id || ["PM", "OWNER", "ADMIN", "CEO"].includes(role);
    if (!isCoordinator) throw new Error("Only the Task Manager or a Project Manager can advance the workflow stage.");
    await transitionStage(tenantId, parsed.taskId, user.id, { toStageKey: parsed.toStageKey, reason: parsed.reason });
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const ActivateDepartmentSchema = z.object({
  taskId: z.string().min(1),
  department: z.enum(DEPARTMENT_ROLES),
  ownerId: z.string().min(1),
  requiredAction: z.string().min(2),
  expectedOutput: z.string().optional(),
  deadline: z.coerce.date().optional(),
  isMandatory: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
});
export async function activateDepartmentAction(input: z.infer<typeof ActivateDepartmentSchema>): Promise<ActionState> {
  try {
    const { tenantId, user } = await requireTaskWriter();
    const parsed = ActivateDepartmentSchema.parse(input);
    await activateDepartment(tenantId, parsed.taskId, user.id, { ...parsed, activatedReason: "Manually assigned" });
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const RequestInvolvementSchema = z.object({
  taskId: z.string().min(1),
  department: z.enum(DEPARTMENT_ROLES),
  reason: z.string().min(2),
  requestedAction: z.string().optional(),
  desiredDeadline: z.coerce.date().optional(),
  shouldBlock: z.boolean().default(true),
});
export async function requestInvolvementAction(input: z.infer<typeof RequestInvolvementSchema>): Promise<ActionState> {
  try {
    const { tenantId, user } = await requireTaskParticipant();
    const parsed = RequestInvolvementSchema.parse(input);
    await requestDepartmentInvolvement(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const RespondInvolvementSchema = z.object({
  requestId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(["ACTION_REQUIRED", "COMMENT_ONLY", "NOT_REQUIRED", "INFO_REQUESTED", "REDIRECTED"]),
  response: z.string().optional(),
  redirectDepartment: z.string().optional(),
  ownerId: z.string().optional(),
  requiredAction: z.string().optional(),
});
export async function respondInvolvementAction(input: z.infer<typeof RespondInvolvementSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = RespondInvolvementSchema.parse(input);
    // Audit C7 — only the department the request was addressed to (its
    // activated owner, or a user whose own role IS that department) may
    // answer on its behalf; TASKS:READ alone is not standing to respond.
    const request = await db.departmentInvolvementRequest.findUnique({ where: { id: parsed.requestId } });
    if (!request || request.tenantId !== tenantId) throw new Error("Request not found.");
    const isTaskAuthority = await isTaskLevelAuthority(tenantId, request.taskId, user.id, role);
    if (!isTaskAuthority) {
      const owner = await db.taskDepartment.findUnique({ where: { taskId_department: { taskId: request.taskId, department: request.department } } });
      const speaksForDepartment = owner ? owner.ownerId === user.id : role === request.department;
      if (!speaksForDepartment) throw new Error("Only the requested department can respond to this involvement request.");
    }
    await respondToInvolvementRequest(tenantId, parsed.requestId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const SubmitDeliverableSchema = z.object({ deliverableId: z.string().min(1), taskId: z.string().min(1) });
export async function submitDeliverableAction(input: z.infer<typeof SubmitDeliverableSchema>): Promise<ActionState> {
  try {
    const { tenantId, user } = await requireTaskParticipant();
    const parsed = SubmitDeliverableSchema.parse(input);
    const deliverable = await db.departmentDeliverable.findUnique({ where: { id: parsed.deliverableId }, include: { taskDepartment: true } });
    if (!deliverable || deliverable.tenantId !== tenantId) throw new Error("Deliverable not found.");
    if (deliverable.taskDepartment.ownerId !== user.id) throw new Error("Only the department's accountable owner can submit this deliverable.");
    await submitDeliverable(tenantId, parsed.deliverableId, user.id);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const MarkNotRequiredSchema = z.object({ deliverableId: z.string().min(1), taskId: z.string().min(1), reason: z.string().min(2) });
export async function markNotRequiredAction(input: z.infer<typeof MarkNotRequiredSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = MarkNotRequiredSchema.parse(input);
    // Audit C7 — same standing as submitting the deliverable: its own
    // accountable department owner, or task-level authority/Admin.
    const deliverable = await db.departmentDeliverable.findUnique({ where: { id: parsed.deliverableId }, include: { taskDepartment: true } });
    if (!deliverable || deliverable.tenantId !== tenantId) throw new Error("Deliverable not found.");
    if (deliverable.taskDepartment.ownerId !== user.id && !(await isTaskLevelAuthority(tenantId, parsed.taskId, user.id, role))) {
      throw new Error("Only the department's accountable owner can mark this deliverable not required.");
    }
    await markNotRequired(tenantId, parsed.deliverableId, user.id, parsed.reason);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const RecordApprovalSchema = z.object({
  taskId: z.string().min(1),
  deliverableId: z.string().optional(),
  action: z.enum(APPROVAL_ACTIONS),
  comment: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  delegatedToId: z.string().optional(),
});
export async function recordApprovalAction(input: z.infer<typeof RecordApprovalSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = RecordApprovalSchema.parse(input);
    // Audit C7 — approval must be enforced here, not just surfaced only to
    // the right people in the UI (CTO-061 governs the *shape* of an
    // approval — a typed, attributable record — not who may create one).
    // Authorized: the task's own manager/decision-owner/final-approver, the
    // accountable owner of the deliverable's department (if any), or Admin.
    let authorized = await isTaskLevelAuthority(tenantId, parsed.taskId, user.id, role);
    if (!authorized && parsed.deliverableId) {
      const deliverable = await db.departmentDeliverable.findUnique({ where: { id: parsed.deliverableId }, include: { taskDepartment: true } });
      if (deliverable && deliverable.tenantId === tenantId && deliverable.taskDepartment.ownerId === user.id) authorized = true;
    }
    if (!authorized) {
      const delegated = await db.taskApproval.findFirst({ where: { tenantId, taskId: parsed.taskId, delegatedToId: user.id } });
      authorized = Boolean(delegated);
    }
    if (!authorized) throw new Error("You are not authorized to record a decision on this task.");
    await recordApproval(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const MarkConditionsMetSchema = z.object({ approvalId: z.string().min(1), taskId: z.string().min(1) });
export async function markConditionsMetAction(input: z.infer<typeof MarkConditionsMetSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = MarkConditionsMetSchema.parse(input);
    // Audit C7 — only the approver who set the conditions (or task-level
    // authority/Admin) can confirm they were satisfied.
    const approval = await db.taskApproval.findUnique({ where: { id: parsed.approvalId } });
    if (!approval || approval.tenantId !== tenantId) throw new Error("Approval not found.");
    if (approval.approverId !== user.id && !(await isTaskLevelAuthority(tenantId, parsed.taskId, user.id, role))) {
      throw new Error("Only the original approver can confirm these conditions were met.");
    }
    await markConditionsMet(tenantId, parsed.approvalId, user.id);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const LinkContractSchema = z.object({
  taskId: z.string().min(1),
  decision: z.enum(CONTRACT_LINK_DECISIONS),
  contractId: z.string().optional(),
  reason: z.string().optional(),
});
export async function linkContractAction(input: z.infer<typeof LinkContractSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = LinkContractSchema.parse(input);
    if (!["LEGAL", "OWNER", "ADMIN", "CEO"].includes(role)) throw new Error("Only Legal can record a contract decision.");
    await linkContract(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const AssignContractorSchema = z.object({
  taskId: z.string().min(1),
  contractorId: z.string().min(1),
  contractId: z.string().optional(),
  scope: z.string().min(2),
  plannedStart: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});
export async function assignContractorAction(input: z.infer<typeof AssignContractorSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = AssignContractorSchema.parse(input);
    if (!["PROCUREMENT", "OWNER", "ADMIN", "CEO"].includes(role)) throw new Error("Only Procurement can assign a contractor.");
    await assignContractor(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const ContractorActionSchema = z.object({ assignmentId: z.string().min(1), taskId: z.string().min(1), action: z.enum(CONTRACTOR_ACTIONS), message: z.string().optional() });
export async function contractorActionAction(input: z.infer<typeof ContractorActionSchema>): Promise<ActionState> {
  try {
    const { tenantId, role, user } = await getCurrentUser();
    if (role !== "CONTRACTOR") throw new Error("Only the assigned contractor can report on this work package.");
    const parsed = ContractorActionSchema.parse(input);
    const assignment = assertTenant(await db.taskContractorAssignment.findUnique({ where: { id: parsed.assignmentId }, include: { contractor: true } }), tenantId, "TaskContractorAssignment");
    if (assignment.contractor.userId !== user.id) throw new Error("This work package is not assigned to you.");
    await contractorAction(tenantId, parsed.assignmentId, user.id, parsed.action, parsed.message);
    revalidatePath("/dashboard/contractor");
  } catch (err) {
    return toError(err);
  }
}

const RecordInspectionSchema = z.object({
  taskId: z.string().min(1),
  inspectionId: z.string().optional(),
  result: z.enum(INSPECTION_RESULTS),
  notes: z.string().optional(),
});
export async function recordInspectionAction(input: z.infer<typeof RecordInspectionSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = RecordInspectionSchema.parse(input);
    if (!["QAQC", "ENGINEER", "OWNER", "ADMIN", "CEO"].includes(role)) throw new Error("Only an inspector (QA/QC or Engineering) can record an inspection result.");
    await recordInspection(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const ExplainDelaySchema = z.object({
  taskId: z.string().min(1),
  deliverableId: z.string().optional(),
  cause: z.string().min(2),
  progressPct: z.coerce.number().min(0).max(100),
  newExpectedDate: z.coerce.date(),
  blockingDependency: z.string().optional(),
  costImpact: z.coerce.number().optional(),
  scheduleImpactDays: z.coerce.number().optional(),
  correctiveAction: z.string().optional(),
});
export async function explainDelayAction(input: z.infer<typeof ExplainDelaySchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = ExplainDelaySchema.parse(input);
    // Audit C7 — a delay explanation is attributed testimony about specific
    // work; restrict it to someone actually accountable for that work
    // (the deliverable's department owner) or task-level authority/Admin.
    let authorized = await isTaskLevelAuthority(tenantId, parsed.taskId, user.id, role);
    if (!authorized && parsed.deliverableId) {
      const deliverable = await db.departmentDeliverable.findUnique({ where: { id: parsed.deliverableId }, include: { taskDepartment: true } });
      if (deliverable && deliverable.tenantId === tenantId && deliverable.taskDepartment.ownerId === user.id) authorized = true;
    } else if (!authorized) {
      const task = await requireTask(tenantId, parsed.taskId);
      authorized = task.mainResponsibleId === user.id || task.createdById === user.id;
    }
    if (!authorized) throw new Error("You are not authorized to explain a delay on this task.");
    await explainDelay(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const EscalateSchema = z.object({ taskId: z.string().min(1), toUserId: z.string().min(1), reason: z.string().min(2) });
export async function escalateAction(input: z.infer<typeof EscalateSchema>): Promise<ActionState> {
  try {
    const { tenantId, user } = await requireTaskParticipant();
    const parsed = EscalateSchema.parse(input);
    await escalate(tenantId, parsed.taskId, user.id, parsed.toUserId, parsed.reason);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const AcknowledgeEscalationSchema = z.object({ escalationId: z.string().min(1), taskId: z.string().min(1) });
export async function acknowledgeEscalationAction(input: z.infer<typeof AcknowledgeEscalationSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskParticipant();
    const parsed = AcknowledgeEscalationSchema.parse(input);
    // Audit C7 — only the person the escalation was actually raised to (or
    // Admin) can acknowledge it; TASKS:READ alone let anyone acknowledge
    // anyone's escalation before this.
    const escalation = await db.taskEscalation.findUnique({ where: { id: parsed.escalationId } });
    if (!escalation || escalation.tenantId !== tenantId) throw new Error("Escalation not found.");
    if (escalation.toUserId !== user.id && !can(role, "USER_MANAGEMENT", "FULL")) {
      throw new Error("Only the person this was escalated to can acknowledge it.");
    }
    await acknowledgeEscalation(tenantId, parsed.escalationId, user.id);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const CompleteTaskSchema = z.object({ taskId: z.string().min(1), comment: z.string().min(2) });
export async function completeTaskAction(input: z.infer<typeof CompleteTaskSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskWriter();
    const parsed = CompleteTaskSchema.parse(input);
    const task = await requireTask(tenantId, parsed.taskId);
    // CTO-081 — only the authorized Task Manager or Project Manager.
    const isAuthorized = task.taskManagerId === user.id || ["PM", "OWNER", "ADMIN", "CEO"].includes(role);
    if (!isAuthorized) throw new Error("Only the Task Manager or a Project Manager can complete this task.");
    await completeTask(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}

const ReopenTaskSchema = z.object({
  taskId: z.string().min(1),
  reason: z.string().min(2),
  newIssue: z.string().optional(),
  newDeadline: z.coerce.date().optional(),
  riskImpact: z.string().optional(),
  reopenedStageKey: z.string().optional(),
});
export async function reopenTaskAction(input: z.infer<typeof ReopenTaskSchema>): Promise<ActionState> {
  try {
    const { tenantId, user, role } = await requireTaskWriter();
    const parsed = ReopenTaskSchema.parse(input);
    const task = await requireTask(tenantId, parsed.taskId);
    const isAuthorized = task.taskManagerId === user.id || ["PM", "OWNER", "ADMIN", "CEO"].includes(role);
    if (!isAuthorized) throw new Error("Only the Task Manager or a Project Manager can reopen this task.");
    await reopenTask(tenantId, parsed.taskId, user.id, parsed);
    revalidatePath(`/tasks/${parsed.taskId}`);
  } catch (err) {
    return toError(err);
  }
}
