// Baseline role and status vocabulary — PRD Section 6 (personas) and Section 7
// (permission matrix). Kept as const arrays/objects rather than Prisma enums
// so the schema stays portable between SQLite (dev) and Postgres (prod).

// Notification preference categories/channels — lives here rather than in
// app/actions/account.ts ("use server") because a Server Actions module may
// only export async functions; a plain array export gets silently replaced
// at the client/server boundary instead of erroring at build time.
export const NOTIFICATION_CATEGORIES = ["TASKS", "APPROVALS", "FINANCE", "PROJECTS"] as const;
export const NOTIFICATION_CHANNELS = ["inApp", "email", "whatsapp"] as const;

export const ROLES = [
  "OWNER",
  "ADMIN",
  "CEO",
  "PM",
  "ARCHITECT",
  "ENGINEER",
  "HR",
  "FINANCE",
  "LEGAL",
  "SALES",
  "PROCUREMENT",
  "STOCK",
  "QAQC",
  "HSE",
  "CONTRACTOR",
  "CLIENT",
  "VIEWER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Company Owner",
  ADMIN: "Company Admin",
  CEO: "CEO / Director",
  PM: "Project Manager",
  ARCHITECT: "Architect",
  ENGINEER: "Engineer",
  HR: "HR",
  FINANCE: "Finance",
  LEGAL: "Legal",
  SALES: "Sales / Commercial",
  PROCUREMENT: "Procurement",
  STOCK: "Stock / Quantity Manager",
  QAQC: "QA/QC",
  HSE: "HSE",
  CONTRACTOR: "Contractor Representative",
  CLIENT: "Client",
  VIEWER: "Viewer / Trainee",
} as const;

// PRD_3 — "@mention a department" reuses the existing Role vocabulary rather
// than introducing a separate Department entity, since every department in
// this app (Architecture, Legal, Finance, ...) already corresponds 1:1 to a
// Role. Deliberately excludes administrative/external roles (OWNER, ADMIN,
// PM, CONTRACTOR, CLIENT, VIEWER) that aren't a "department" someone routes
// client work to.
export const DEPARTMENT_ROLES = [
  "ARCHITECT",
  "ENGINEER",
  "HR",
  "FINANCE",
  "LEGAL",
  "SALES",
  "PROCUREMENT",
  "STOCK",
  "QAQC",
  "HSE",
] as const satisfies readonly Role[];

export const DEPARTMENT_LABELS: Record<(typeof DEPARTMENT_ROLES)[number], string> = {
  ARCHITECT: "Architecture Department",
  ENGINEER: "Engineering Department",
  HR: "HR Department",
  FINANCE: "Finance Department",
  LEGAL: "Legal Department",
  SALES: "Sales Department",
  PROCUREMENT: "Procurement Department",
  STOCK: "Stock Department",
  QAQC: "QA/QC Department",
  HSE: "HSE Department",
};

export const ACCESS_MODES = ["STANDARD", "VIEW_ONLY", "SUSPENDED", "ARCHIVED"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const TASK_STATUSES = [
  "TO_DO",
  "IN_PROGRESS",
  "REVIEW",
  "APPROVED",
  "COMPLETED",
  "BLOCKED",
  "ON_HOLD",
  "NEEDS_REVISION",
  "REJECTED",
  "OVERDUE",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  ON_HOLD: "On Hold",
  NEEDS_REVISION: "Needs Revision",
  REJECTED: "Rejected",
  OVERDUE: "Overdue",
};

// Dictionary key (under the "task" namespace) for each status — use with
// t(TASK_STATUS_KEY[status]) to render a localized label instead of the
// English-only TASK_STATUS_LABELS fallback above.
export const TASK_STATUS_KEY: Record<TaskStatus, string> = {
  TO_DO: "task.toDo",
  IN_PROGRESS: "task.inProgress",
  REVIEW: "task.review",
  APPROVED: "task.approved",
  COMPLETED: "task.completed",
  BLOCKED: "task.blocked",
  ON_HOLD: "task.onHold",
  NEEDS_REVISION: "task.needsRevision",
  REJECTED: "task.rejected",
  OVERDUE: "task.overdue",
};

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PROJECT_STATUSES = [
  "ON_TRACK",
  "AT_RISK",
  "DELAYED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

// Fixed status colour mapping — DAS-003 requires universal, non-configurable
// status colours so users learn them once across the whole platform.
export const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  ON_TRACK: "success",
  ACTIVE: "success",
  APPROVED: "success",
  COMPLETED: "success",
  PAID: "success",
  CONFIRMED: "success",
  AT_RISK: "warning",
  PENDING: "warning",
  IN_REVIEW: "warning",
  SUBMITTED: "info",
  SENT: "info",
  IN_PROGRESS: "info",
  REVIEW: "info",
  DELAYED: "danger",
  OVERDUE: "danger",
  REJECTED: "danger",
  BLOCKED: "danger",
  NEEDS_REVISION: "warning",
  DRAFT: "neutral",
  TO_DO: "neutral",
  ARCHIVED: "neutral",
  SUSPENDED: "danger",
  VIEW_ONLY: "neutral",
  STANDARD: "success",
  ACCEPTED: "success",
  EXPIRED: "neutral",
  REVOKED: "danger",
  TERMINATED: "danger",
  PROSPECT: "info",
  INACTIVE: "neutral",
  OPEN: "warning",
  RESOLVED: "success",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "danger",

  // --- PRD_4 Cross-Department Task Orchestration ------------------------
  WAITING_FOR_DEPENDENCY: "warning",
  WAITING_FOR_INFORMATION: "warning",
  WAITING_FOR_APPROVAL: "warning",
  WAITING_FOR_CONTRACT: "warning",
  WAITING_FOR_PROCUREMENT: "warning",
  WAITING_FOR_CONTRACTOR: "warning",
  WAITING_FOR_INSPECTION: "warning",
  UNDER_TRIAGE: "info",
  UNDER_REVIEW: "info",
  UNDER_FINAL_VERIFICATION: "info",
  SCHEDULED: "info",
  IN_EXECUTION: "info",
  INFORMATION_REQUESTED: "warning",
  NOT_REQUIRED: "neutral",
  NOT_STARTED: "neutral",
  REVISION_REQUIRED: "warning",
  REOPENED: "warning",
  PASSED: "success",
  PASSED_WITH_OBSERVATIONS: "warning",
  FAILED: "danger",
  REWORK_REQUIRED: "warning",
  ADDITIONAL_INSPECTION_REQUIRED: "warning",
  SKIPPED: "neutral",
  WAITING: "warning",
  OFFICIAL: "success",
  SUPERSEDED: "neutral",
  SUPPORTING: "neutral",
  ASSIGNED: "info",
  CLARIFICATION_REQUESTED: "warning",
  READY_FOR_INSPECTION: "info",
  ACTION_REQUIRED: "warning",
  COMMENT_ONLY: "neutral",
  REDIRECTED: "neutral",
};

// ---------------------------------------------------------------------------
// PRD_4 — Cross-Department Task Orchestration
// ---------------------------------------------------------------------------

// Governs a task's life *after* creation. `orchestrationStatus` on Task uses
// this vocabulary once orchestration starts — see Task.orchestrationStatus's
// schema comment for why it's a separate field from the plain-task `status`.
export const ORCHESTRATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_TRIAGE",
  "ACTIVE",
  "WAITING_FOR_INFORMATION",
  "WAITING_FOR_APPROVAL",
  "WAITING_FOR_CONTRACT",
  "WAITING_FOR_PROCUREMENT",
  "WAITING_FOR_CONTRACTOR",
  "SCHEDULED",
  "IN_EXECUTION",
  "WAITING_FOR_INSPECTION",
  "UNDER_FINAL_VERIFICATION",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "REOPENED",
  "ARCHIVED",
] as const;
export type OrchestrationStatus = (typeof ORCHESTRATION_STATUSES)[number];

export const DELIVERABLE_STATUSES = [
  "NOT_STARTED",
  "WAITING_FOR_DEPENDENCY",
  "ACTIVE",
  "INFORMATION_REQUESTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "NOT_REQUIRED",
  "BLOCKED",
  "COMPLETED",
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

// CTO-020 — these statuses block parent-task completion (§4.2/§11.2).
export const DELIVERABLE_STATUSES_BLOCKING_COMPLETION: readonly DeliverableStatus[] = [
  "NOT_STARTED",
  "WAITING_FOR_DEPENDENCY",
  "ACTIVE",
  "INFORMATION_REQUESTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REJECTED",
  "REVISION_REQUIRED",
  "BLOCKED",
];

export const TASK_STAGE_STATUSES = ["PENDING", "ACTIVE", "WAITING", "COMPLETED", "SKIPPED", "REJECTED"] as const;
export type TaskStageStatus = (typeof TASK_STAGE_STATUSES)[number];

export const INSPECTION_RESULTS = [
  "PASSED",
  "PASSED_WITH_OBSERVATIONS",
  "FAILED",
  "REWORK_REQUIRED",
  "ADDITIONAL_INSPECTION_REQUIRED",
] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

// §11.1 — a failed/rework result routes back to contractor execution; any
// other typed result is a pass (CTO-080).
export const INSPECTION_RESULTS_REQUIRING_REWORK: readonly InspectionResult[] = ["FAILED", "REWORK_REQUIRED"];

// CTO-061 — approval is always one of these typed actions, never a plain comment.
export const APPROVAL_ACTIONS = [
  "APPROVE",
  "APPROVE_WITH_CONDITIONS",
  "REJECT",
  "REQUEST_REVISION",
  "REQUEST_INFO",
  "DELEGATE",
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const CONTRACT_LINK_DECISIONS = [
  "EXISTING_CONTRACT",
  "VARIATION_REQUIRED",
  "NEW_CONTRACT_REQUIRED",
  "NOT_REQUIRED",
  "FURTHER_ASSESSMENT",
] as const;
export type ContractLinkDecision = (typeof CONTRACT_LINK_DECISIONS)[number];

export const CONTRACTOR_ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "CLARIFICATION_REQUESTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "DELAYED",
  "READY_FOR_INSPECTION",
  "REWORK_REQUIRED",
  "COMPLETED",
] as const;
export type ContractorAssignmentStatus = (typeof CONTRACTOR_ASSIGNMENT_STATUSES)[number];

export const INVOLVEMENT_REQUEST_STATUSES = [
  "PENDING",
  "ACTION_REQUIRED",
  "COMMENT_ONLY",
  "NOT_REQUIRED",
  "INFO_REQUESTED",
  "REDIRECTED",
] as const;
export type InvolvementRequestStatus = (typeof INVOLVEMENT_REQUEST_STATUSES)[number];

export const TASK_PARTICIPANT_ROLES = ["CONTRIBUTOR", "REVIEWER", "WATCHER"] as const;
export type TaskParticipantRole = (typeof TASK_PARTICIPANT_ROLES)[number];

// §8.2 file categories and §8.3 file states — apply to DocumentFile rows
// where taskId is set. Pre-existing free-text category/status still applies
// to non-task documents (projects, clients).
export const TASK_FILE_CATEGORIES = [
  "INITIAL_EVIDENCE",
  "TECHNICAL_ASSESSMENT",
  "DRAWING",
  "CALCULATION",
  "SPECIFICATION",
  "QUOTATION",
  "PURCHASE_ORDER",
  "CONTRACT",
  "CONTRACT_VARIATION",
  "METHOD_STATEMENT",
  "SAFETY_DOCUMENT",
  "INSPECTION",
  "COMPLETION_EVIDENCE",
  "INVOICE",
  "PAYMENT_EVIDENCE",
  "FINAL_RECORD",
] as const;
export type TaskFileCategory = (typeof TASK_FILE_CATEGORIES)[number];

export const TASK_FILE_STATES = [
  "SUPPORTING",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
  "OFFICIAL",
  "ARCHIVED",
] as const;
export type TaskFileState = (typeof TASK_FILE_STATES)[number];

// §6.2's reference flow / §15's facade-repair walkthrough, shipped as the one
// built-in reusable workflow template (Appendix A leaves a configurable
// visual workflow *builder* as P2-Advanced — out of this pass). "Conditional
// branches" (§6.1) are modeled as authorized stage-skipping with a reason
// (also required by §6.1) rather than a separate branching DSL: a task that
// doesn't need a contractor skips CONTRACTOR_ASSIGNMENT/SITE_EXECUTION and
// goes straight to INSPECTION, exactly like the reference flow's "Internal
// execution, OR / Contractor required" fork.
export const DEFAULT_WORKFLOW_STAGES: readonly { key: string; label: string }[] = [
  { key: "PM_TRIAGE", label: "PM Triage" },
  { key: "ENGINEERING_ASSESSMENT", label: "Engineering Assessment" },
  { key: "REPAIR_CONFIRMED", label: "Repair Confirmed" },
  { key: "PROCUREMENT_ASSESSMENT", label: "Procurement Assessment" },
  { key: "LEGAL_ASSESSMENT", label: "Legal Assessment" },
  { key: "CONTRACTOR_ASSIGNMENT", label: "Contractor Assignment" },
  { key: "SITE_EXECUTION", label: "Site Execution" },
  { key: "INSPECTION", label: "Engineering / QA Inspection" },
  { key: "FINAL_VERIFICATION", label: "PM Final Verification" },
];

// §12.2's sequence is "Responsible employee -> Department Manager -> Task
// Manager -> Project Manager -> Project Director -> CEO." The first two hops
// are already the task's own department-owner/task-manager FKs; there's no
// separate "Project Director" role in this app's Role vocabulary, so once
// the task-specific chain is exhausted, escalation continues through
// company-wide PM then CEO.
export const ESCALATION_CHAIN: readonly Role[] = ["PM", "CEO"];
