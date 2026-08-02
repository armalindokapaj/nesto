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
};
