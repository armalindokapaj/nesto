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
  "DOCUMENTS",
  // PRD_Government_Legal_Compliance — a Resource, distinct from the existing
  // LEGAL *role* below (which already owns CONTRACTS). Kept separate from
  // CONTRACTS because "project access does not automatically grant case or
  // legal-opinion access" (the PRD's core rule) — folding it into CONTRACTS
  // would violate that on day one.
  "LEGAL",
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
  DOCUMENTS: "FULL",
  LEGAL: "FULL",
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
    // CEO carries approval authority (Blue Ticket §13) alongside OWNER/ADMIN.
    DOCUMENTS: "FULL",
    LEGAL: "FULL",
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
    DOCUMENTS: "WRITE",
    // PMs need to see a project's Legal Readiness Gate before scheduling work.
    LEGAL: "READ",
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
    // Architects originate and revise drawings — the primary uploader role.
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    DOCUMENTS: "WRITE",
    // Finance tracks fines/insurance/guarantees that intersect Legal records.
    LEGAL: "READ",
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
    DOCUMENTS: "WRITE",
    // Legal owns the new Government/Legal/Compliance module outright.
    LEGAL: "FULL",
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
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    // Contractors now live in Procurement's own sidebar (subcontractor
    // sourcing/onboarding is a procurement responsibility) — WRITE so they
    // can actually create/edit records, not just view them.
    COMPANY_NETWORK: "WRITE",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    // Procurement owns its own department, mirroring HR/Finance's own FULL
    // grant on their respective resource.
    PROCUREMENT: "FULL",
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    DOCUMENTS: "READ",
    LEGAL: "NONE",
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
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
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
    DOCUMENTS: "WRITE",
    LEGAL: "NONE",
  },
  // PRD_4 CTO-100/§14 — a contractor gets task-scoped access to their own
  // TaskContractorAssignment work packages only (see getContractorWorkPackages
  // in server/task-orchestration.ts), never the general Projects/Finance/
  // Contracts/Company-Network modules other roles browse.
  CONTRACTOR: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "NONE",
    TASKS: "NONE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "NONE",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
    // Phase 8 — was DOCUMENTS: "READ", which contradicted the paragraph above:
    // listModuleDocuments() only uses its userId argument for the STARRED and
    // MINE scopes, so the default "ALL" scope returned every document in the
    // tenant. An external login browsing /documents saw the whole corpus.
    DOCUMENTS: "NONE",
    LEGAL: "NONE",
  },
  // Phase 8 — a client is an outside organization, so it gets the same
  // treatment as CONTRACTOR above: its entire workspace is the scoped portal
  // console (/dashboard/portal), and no general module at all.
  //
  // These were READ on PROJECTS/TASKS/CONTRACTS/COMPANY_NETWORK/DOCUMENTS.
  // Resource-level READ with no row-level scoping is what made that a leak:
  // /contracts runs listContracts(tenantId) and rendered every contract in
  // the company with its value and counterparty; /documents returned the full
  // corpus; both pages' project filters ran listProjects(tenantId). Only
  // /tasks was genuinely row-scoped (canViewTask, PRD_10).
  //
  // Row-scoping those shared pages is not available as a fix here: Projects is
  // frozen, and the portal grant layer (BusinessAccessRelationship) has no
  // representation on any of them. Withholding the module is the honest state
  // until a scoped client view of each is actually built.
  CLIENT: {
    COMPANY_SETTINGS: "NONE",
    USER_MANAGEMENT: "NONE",
    PROJECTS: "NONE",
    TASKS: "NONE",
    FINANCE: "NONE",
    HR: "NONE",
    CONTRACTS: "NONE",
    AUDIT_LOGS: "NONE",
    COMPANY_NETWORK: "NONE",
    CLIENTS: "NONE",
    HSE_REPORTS: "NONE",
    PROCUREMENT: "NONE",
    DOCUMENTS: "NONE",
    LEGAL: "NONE",
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
    DOCUMENTS: "READ",
    LEGAL: "NONE",
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
  ENGINEER: "/dashboard/engineering",
  HR: "/dashboard/hr",
  FINANCE: "/dashboard/finance",
  LEGAL: "/dashboard/legal",
  SALES: "/dashboard/sales",
  PROCUREMENT: "/dashboard/procurement",
  STOCK: "/dashboard/inventory",
  QAQC: "/dashboard/qaqc",
  HSE: "/dashboard/hse",
  CONTRACTOR: "/dashboard/contractor",
  CLIENT: "/dashboard/portal",
  VIEWER: "/dashboard/executive",
};

// Roles belonging to an outside organization rather than the company. The set
// is CLIENT/CONTRACTOR because that is exactly what the portal layer was built
// against — see the ExternalOrganization schema comment, which reuses "the
// existing CLIENT/CONTRACTOR UserIdentity login" rather than standing up a
// second auth system. VIEWER is deliberately NOT here: it is labelled
// "Viewer / Trainee", an internal read-only seat, so it keeps the company-wide
// project visibility PRD_10 §5.1 grants every company member.
//
// An external role must never see tenant-wide aggregates. This matters well
// beyond the dashboard each role lands on: 244 pages `redirect("/dashboard/
// executive")` when a permission check fails, which made the executive console
// the app's universal denied-access fallback. Gating that one page (see
// dashboard/executive/page.tsx) closes every one of those paths at once.
export const EXTERNAL_ROLES = ["CLIENT", "CONTRACTOR"] as const satisfies readonly Role[];

export function isExternalRole(role: Role): boolean {
  return (EXTERNAL_ROLES as readonly Role[]).includes(role);
}
