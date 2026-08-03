import type { Role } from "@/lib/constants";
import { can } from "@/lib/permissions";

// PRD_10 — a company-wide-visible project shell does not mean company-wide
// visible project *data*. This module answers the two questions PRD_10
// needs that the coarse `can(role, resource, level)` matrix in permissions.ts
// can't: "does this specific task's own visibility let this user see it?"
// and "what is this user's real relationship to this project?" Both reuse
// existing relations (Task.visibility/departmentRole, TaskContribution,
// TaskParticipant, ProjectMember) instead of new models, per PRD_10 §11
// ("do not duplicate module permissions inside the Project entity").

export type TaskVisibilityRecord = {
  visibility: string;
  createdById: string;
  mainResponsibleId: string | null;
  taskManagerId: string | null;
  decisionOwnerId: string | null;
  finalApproverId: string | null;
  departmentRole: string | null;
  contributions: { userId: string }[];
  participants: { userId: string; role: string }[];
};

export type TaskViewer = { userId: string; role: Role };

export function isInvolvedInTask(task: TaskVisibilityRecord, userId: string): boolean {
  return (
    task.createdById === userId ||
    task.mainResponsibleId === userId ||
    task.taskManagerId === userId ||
    task.decisionOwnerId === userId ||
    task.finalApproverId === userId ||
    task.contributions.some((c) => c.userId === userId) ||
    task.participants.some((p) => p.userId === userId)
  );
}

// A task's own `visibility` (PRD_3 field, never enforced anywhere until
// PRD_10) independently gates read access, on top of whatever the coarser
// TASKS resource permission already allows the page itself to load.
export function canViewTask(task: TaskVisibilityRecord, viewer: TaskViewer): boolean {
  if (task.visibility === "COMPANY_PUBLIC" || !task.visibility) return true;
  if (isInvolvedInTask(task, viewer.userId)) return true;
  // Company-wide oversight roles keep visibility regardless of a task's own
  // privacy setting — PRD_10 §7: "Company Admin ... broad company-level
  // powers" / "Company Owner retains highest company authority."
  if (can(viewer.role, "USER_MANAGEMENT", "FULL")) return true;
  if (task.visibility === "DEPARTMENT_PUBLIC") return task.departmentRole === viewer.role;
  return false; // PRIVATE and not involved
}

export const PROJECT_RELATIONSHIPS = [
  "ASSIGNED",
  "APPROVER",
  "TASK_CONTRIBUTOR",
  "REVIEWER",
  "WATCHER",
  "DEPARTMENT_INVOLVED",
  "UNASSIGNED",
] as const;
export type ProjectRelationship = (typeof PROJECT_RELATIONSHIPS)[number];

export type ProjectRelationshipInput = {
  memberUserIds: string[];
  tasks: TaskVisibilityRecord[];
};

// PRD_10 §5.1 "User relationship badge" — a single most-relevant label
// derived from real project/task relationships, never a manually-set flag,
// so it can't drift out of sync with actual assignments.
export function getProjectRelationship(input: ProjectRelationshipInput, viewer: TaskViewer): ProjectRelationship {
  if (input.memberUserIds.includes(viewer.userId)) return "ASSIGNED";

  let isApprover = false;
  let isContributor = false;
  let isReviewer = false;
  let isWatcher = false;
  let isDepartmentInvolved = false;

  for (const task of input.tasks) {
    if (task.finalApproverId === viewer.userId || task.decisionOwnerId === viewer.userId) isApprover = true;
    if (
      task.createdById === viewer.userId ||
      task.mainResponsibleId === viewer.userId ||
      task.taskManagerId === viewer.userId ||
      task.contributions.some((c) => c.userId === viewer.userId)
    ) {
      isContributor = true;
    }
    if (task.participants.some((p) => p.userId === viewer.userId && p.role === "REVIEWER")) isReviewer = true;
    if (task.participants.some((p) => p.userId === viewer.userId && p.role === "WATCHER")) isWatcher = true;
    if (task.departmentRole && task.departmentRole === viewer.role) isDepartmentInvolved = true;
  }

  if (isApprover) return "APPROVER";
  if (isContributor) return "TASK_CONTRIBUTOR";
  if (isReviewer) return "REVIEWER";
  if (isDepartmentInvolved) return "DEPARTMENT_INVOLVED";
  if (isWatcher) return "WATCHER";
  return "UNASSIGNED";
}

// PRD_10 §6 "View Finance" — project visibility never implies financial
// visibility; reuses the same FINANCE resource gate Finance dashboard pages
// already enforce, so a Sales/PM/Architect user sees budget/contract value
// as "Restricted" rather than a real figure.
export function canViewProjectFinance(role: Role): boolean {
  return can(role, "FINANCE", "READ");
}
