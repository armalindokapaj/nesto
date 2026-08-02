import type { Role } from "@/lib/constants";

// Baseline Role/Permission matrix — PRD Section 7. Collapsed from the PRD's
// per-cell labels ("Assigned", "Restricted", "Payroll only", ...) into four
// ordered access levels for Phase-1 route/section gating. The full per-record
// nuance (e.g. "own contracts only") is enforced separately at the query layer
// in src/server/*, not here — this module answers the coarse "can this role
// see this section at all" question used to gate dashboards and nav items.

export const RESOURCES = [
  "COMPANY_SETTINGS",
  "USER_MANAGEMENT",
  "PROJECTS",
  "TASKS",
  "FINANCE",
  "HR",
  "CONTRACTS",
  "AUDIT_LOGS",
  "COMPANY_NETWORK",
  "CLIENTS",
  "HSE_REPORTS",
  "PROCUREMENT",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Level = "NONE" | "READ" | "WRITE" | "FULL";

const LEVEL_RANK: Record<Level, number> = { NONE: 0, READ: 1, WRITE: 2, FULL: 3 };

type Matrix = Record<Role, Record<Resource, Level>>;

const FULL_ADMIN: Record<Resource, Level> = {
  COMPANY_SETTINGS: "FULL",
  USER_MANAGEMENT: "FULL",
  PROJECTS: "FULL",
  TASKS: "FULL",
  FINANCE: "FULL",
  HR: "FULL",
  CONTRACTS: "FULL",
  AUDIT_LOGS: "FULL",
  COMPANY_NETWORK: "FULL",
  CLIENTS: "FULL",
  HSE_REPORTS: "FULL",
  PROCUREMENT: "FULL",
};

export const PERMISSION_MATRIX: Matrix = {
  OWNER: FULL_ADMIN,
  ADMIN: FULL_ADMIN,
  CEO: {
    COMPANY_SETTINGS: "READ",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "FULL",
    TASKS: "FULL",
    FINANCE: "FULL",
    HR: "READ",
    CONTRACTS: "FULL",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "FULL",
    HSE_REPORTS: "READ",
    PROCUREMENT: "FULL",
  },
  PM: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "WRITE",
    TASKS: "WRITE",
    FINANCE: "READ",
    HR: "READ",
    CONTRACTS: "WRITE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "WRITE",
    HSE_REPORTS: "WRITE",
    // PMs request materials/POs for their own projects.
    PROCUREMENT: "WRITE",
  },
  ARCHITECT: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    // Architects originate new design projects and bring their own drawing
    // set/renders/floor plans with them at creation time.
    PROJECTS: "WRITE",
    TASKS: "WRITE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    // Sales assigns tasks to Architects against a client's floor plan, etc.
    // — Architects need to reach the client profile the task references.
    CLIENTS: "WRITE",
    // Architects act on HSE findings that trace back to design (e.g. a
    // clash needing a drawing fix).
    HSE_REPORTS: "WRITE",
    PROCUREMENT: "NONE",
  },
  ENGINEER: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "WRITE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "WRITE",
    HSE_REPORTS: "WRITE",
    PROCUREMENT: "NONE",
  },
  HR: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "NONE",
    HR: "FULL",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
  FINANCE: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "FULL",
    HR: "READ",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    // Finance contributes billing documents to a client's profile (PRD ask:
    // "connected also with legal and finance... every department can
    // contribute... to upload materials").
    CLIENTS: "WRITE",
    HSE_REPORTS: "NONE",
    // Finance needs visibility into committed spend for budgeting, without
    // being able to create/approve purchase orders themselves.
    PROCUREMENT: "READ",
  },
  LEGAL: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "READ",
    HR: "NONE",
    CONTRACTS: "FULL",
    AUDIT_LOGS: "NONE",
    // Legal manages contractor vetting alongside contracts (CONTRACTS: FULL
    // above) — WRITE here lets them create contractor profiles instead of
    // being blocked mid-way through drafting a new contract.
    COMPANY_NETWORK: "WRITE",
    CLIENTS: "WRITE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
  SALES: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "WRITE",
    FINANCE: "READ",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    // Sales owns the client relationship, not the contractor/subcontractor
    // network — those are two distinct counterparties on opposite sides of
    // the business, and Sales has no reason to see or manage contractors.
    COMPANY_NETWORK: "NONE",
    CLIENTS: "FULL",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
  PROCUREMENT: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "NONE",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    // Procurement owns its own department, mirroring HR/Finance's own FULL
    // grant on their respective resource.
    PROCUREMENT: "FULL",
  },
  STOCK: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    HSE_REPORTS: "READ",
    // Stock/quantity management coordinates materials receiving directly
    // with Procurement's purchase orders.
    PROCUREMENT: "WRITE",
  },
  QAQC: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "WRITE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    // Quality and safety overlap on site — QAQC can co-manage findings.
    HSE_REPORTS: "WRITE",
    PROCUREMENT: "NONE",
  },
  HSE: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "WRITE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    // HSE owns this module — files findings and tracks them through to fixed.
    HSE_REPORTS: "FULL",
    PROCUREMENT: "NONE",
  },
  CONTRACTOR: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "READ",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
  CLIENT: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
  VIEWER: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "READ",
    TASKS: "READ",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "READ",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "READ",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
  },
};

/** Returns the access level a role has on a resource. */
export function levelFor(role: Role, resource: Resource): Level {
  return PERMISSION_MATRIX[role]?.[resource] ?? "NONE";
}

/** Deny-by-default check: does `role` have at least `required` access to `resource`? (SEC-003) */
export function can(role: Role, resource: Resource, required: Level = "READ") {
  return LEVEL_RANK[levelFor(role, resource)] >= LEVEL_RANK[required];
}

/** View-only access mode overrides any role grant to read-only (AUT-003). */
export function canWrite(role: Role, resource: Resource, accessMode: string) {
  if (accessMode === "VIEW_ONLY" || accessMode === "SUSPENDED" || accessMode === "ARCHIVED") {
    return false;
  }
  return can(role, resource, "WRITE");
}

export const DASHBOARD_BY_ROLE: Record<Role, string> = {
  OWNER: "/dashboard/executive",
  ADMIN: "/dashboard/admin",
  CEO: "/dashboard/executive",
  PM: "/dashboard/executive",
  ARCHITECT: "/dashboard/architect",
  ENGINEER: "/dashboard/architect",
  HR: "/dashboard/hr",
  FINANCE: "/dashboard/finance",
  LEGAL: "/dashboard/executive",
  SALES: "/dashboard/executive",
  PROCUREMENT: "/dashboard/procurement",
  STOCK: "/dashboard/executive",
  QAQC: "/dashboard/executive",
  HSE: "/dashboard/executive",
  CONTRACTOR: "/dashboard/executive",
  CLIENT: "/dashboard/executive",
  VIEWER: "/dashboard/executive",
};
