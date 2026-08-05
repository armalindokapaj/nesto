// Platform Configuration — the toggle catalog and resolver.
//
// Mandated by 7 of the 8 module PRDs (Inventory §60, Teams §32, CRM §41,
// Contracts §44, Finance §39, Assets §19, plus Documents' configurable folder
// templates). Every module, page, section, widget, feature, workflow, action
// and report is addressable by a dotted key and can be switched off per tenant
// or per company, and a disabled node must disappear from navigation, search,
// APIs and layouts — "no dead links or blank spaces".
//
// This file is pure (no DB, no `server-only`) so the same resolution logic runs
// in server components, route handlers, action guards and client nav filtering,
// and so it can be unit-tested directly.

export const CONFIG_LEVELS = [
  "MODULE",
  "PAGE",
  "SECTION",
  "WIDGET",
  "FEATURE",
  "WORKFLOW",
  "ACTION",
  "REPORT",
] as const;
export type ConfigLevel = (typeof CONFIG_LEVELS)[number];

export type ConfigNode = {
  key: string;
  label: string;
  level: ConfigLevel;
  /** Dotted key of the parent node. Disabling a parent disables the subtree. */
  parent?: string;
  /** Route this node gates, when it is a PAGE. Used to filter navigation. */
  route?: string;
  /** Default when no override row exists. Everything ships enabled. */
  defaultEnabled?: boolean;
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
// Modules already built out declare their full node tree. Modules not yet
// implemented declare their MODULE node only, so they can be toggled from day
// one and fill in their own pages/sections as they are built.

export const CONFIG_NODES: ConfigNode[] = [
  // --- Documents (PRD_Documents_Module) ------------------------------------
  { key: "documents", label: "Documents", level: "MODULE" },
  { key: "documents.page.module", label: "Documents Module Page", level: "PAGE", parent: "documents", route: "/documents" },
  { key: "documents.page.detail", label: "Document Page", level: "PAGE", parent: "documents" },
  { key: "documents.section.folder_tree", label: "Folder tree", level: "SECTION", parent: "documents.page.module" },
  { key: "documents.section.summary_cards", label: "Status summary cards", level: "SECTION", parent: "documents.page.module" },
  { key: "documents.section.passport", label: "Document Passport panel", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.revisions", label: "Revisions", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.comments", label: "Comments", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.activity", label: "Activity timeline", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.feature.tranzit", label: "Project Tranzit folder", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.collections", label: "Document collections", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.required_reading", label: "Required reading", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.watermarks", label: "Watermarks", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.dependencies", label: "Dependencies & impact warnings", level: "FEATURE", parent: "documents" },
  { key: "documents.workflow.promote", label: "Promote from Tranzit", level: "WORKFLOW", parent: "documents.feature.tranzit" },
  { key: "documents.action.upload", label: "Upload document", level: "ACTION", parent: "documents" },
  { key: "documents.action.upload_revision", label: "Upload revision", level: "ACTION", parent: "documents" },
  { key: "documents.action.create_shortcut", label: "Create shortcut", level: "ACTION", parent: "documents" },
  { key: "documents.action.archive", label: "Archive / restore", level: "ACTION", parent: "documents" },
  { key: "documents.report.storage", label: "Storage dashboard", level: "REPORT", parent: "documents" },

  // --- Modules pending build ------------------------------------------------
  { key: "tasks", label: "Tasks", level: "MODULE" },
  { key: "tasks.page.module", label: "Tasks Module Page", level: "PAGE", parent: "tasks", route: "/tasks" },
  { key: "teams", label: "Teams", level: "MODULE" },
  { key: "crm", label: "CRM", level: "MODULE" },
  { key: "crm.page.clients", label: "Clients", level: "PAGE", parent: "crm", route: "/clients" },
  { key: "contracts", label: "Contracts", level: "MODULE" },
  { key: "contracts.page.module", label: "Contracts Module Page", level: "PAGE", parent: "contracts", route: "/contracts" },
  { key: "finance", label: "Finance", level: "MODULE" },
  { key: "inventory", label: "Inventory", level: "MODULE" },
  { key: "assets", label: "Assets", level: "MODULE" },

  // --- HR, Payroll & Workforce (PRD_HR_Payroll_Workforce v1.0, Phase 1) ----
  { key: "hr", label: "HR, Payroll & Workforce", level: "MODULE" },
  { key: "hr.page.overview", label: "HR Overview", level: "PAGE", parent: "hr", route: "/dashboard/hr" },
  { key: "hr.page.employees", label: "Employees", level: "PAGE", parent: "hr", route: "/dashboard/hr/employees" },
  { key: "hr.page.employee_detail", label: "Employee Page", level: "PAGE", parent: "hr", route: "/dashboard/hr/employees/[id]" },
  { key: "hr.page.leave", label: "Leave Requests", level: "PAGE", parent: "hr", route: "/dashboard/hr/leave" },
  { key: "hr.page.training", label: "Training", level: "PAGE", parent: "hr", route: "/dashboard/hr/training" },
  { key: "hr.section.employment_history", label: "Employment History", level: "SECTION", parent: "hr.page.employee_detail" },
  { key: "hr.section.compensation", label: "Compensation (confidential)", level: "SECTION", parent: "hr.page.employee_detail" },
  { key: "hr.feature.intercompany_transfer", label: "Intercompany Transfer", level: "FEATURE", parent: "hr" },
  { key: "hr.action.record_employment", label: "Record Employment Change", level: "ACTION", parent: "hr" },

  // --- HR Payroll (PRD_HR_Payroll_Workforce v1.0, Phase 2) ------------------
  { key: "hr.page.payroll", label: "Payroll", level: "PAGE", parent: "hr", route: "/dashboard/hr/payroll" },
  { key: "hr.page.payroll_run", label: "Payroll Run", level: "PAGE", parent: "hr", route: "/dashboard/hr/payroll/runs/[id]" },
  { key: "hr.page.my_payslips", label: "My Payslips", level: "PAGE", parent: "hr", route: "/dashboard/hr/payroll/my-payslips" },
  { key: "hr.feature.payroll_adjustment", label: "Payroll Adjustment Runs", level: "FEATURE", parent: "hr" },
  { key: "hr.action.calculate_payroll", label: "Calculate Payroll Run", level: "ACTION", parent: "hr" },
  { key: "hr.action.lock_payroll_run", label: "Lock Payroll Run", level: "ACTION", parent: "hr" },

  // --- Government, Legal & Compliance (PRD_Government_Legal_Compliance v1.0, Phase 1) ---
  { key: "legal", label: "Government, Legal & Compliance", level: "MODULE" },
  { key: "legal.page.dashboard", label: "Legal Dashboard", level: "PAGE", parent: "legal", route: "/dashboard/legal" },
  { key: "legal.page.permits", label: "Permits", level: "PAGE", parent: "legal", route: "/dashboard/legal/permits" },
  { key: "legal.page.permit_detail", label: "Permit Page", level: "PAGE", parent: "legal", route: "/dashboard/legal/permits/[id]" },
  { key: "legal.page.project_status", label: "Project Legal Status", level: "PAGE", parent: "legal", route: "/dashboard/legal/projects/[projectId]" },
  { key: "legal.section.readiness_gate", label: "Legal Readiness Gate", level: "SECTION", parent: "legal.page.project_status" },
  { key: "legal.feature.readiness_gate", label: "Work-Blocking Legal Readiness Gate", level: "FEATURE", parent: "legal" },
  { key: "legal.action.create_permit", label: "Create Permit", level: "ACTION", parent: "legal" },
  { key: "legal.action.amend_permit", label: "Amend Permit", level: "ACTION", parent: "legal" },
  { key: "legal.action.set_readiness", label: "Set Legal Readiness Status", level: "ACTION", parent: "legal" },

  // --- HSE (PRD_HSE_Module v1.0, Phase 1) -----------------------------------
  // Reuses the existing "HSE_REPORTS" resource/moduleKey (permissions.ts,
  // modules.ts) for gating — this Platform Config module key stays scoped
  // to page/section/feature/action toggles for the wider HSE domain.
  { key: "hse", label: "HSE (Health, Safety & Environment)", level: "MODULE" },
  { key: "hse.page.dashboard", label: "HSE Dashboard", level: "PAGE", parent: "hse", route: "/dashboard/hse" },
  { key: "hse.page.hazards", label: "Hazards & Risk Assessments", level: "PAGE", parent: "hse", route: "/dashboard/hse/hazards" },
  { key: "hse.page.permits", label: "Permits to Work", level: "PAGE", parent: "hse", route: "/dashboard/hse/permits" },
  { key: "hse.page.permit_detail", label: "Permit to Work Page", level: "PAGE", parent: "hse", route: "/dashboard/hse/permits/[id]" },
  { key: "hse.page.stop_work", label: "Stop Work Orders", level: "PAGE", parent: "hse", route: "/dashboard/hse/stop-work" },
  { key: "hse.section.gate", label: "Work-Start Safety Gate", level: "SECTION", parent: "hse.page.dashboard" },
  { key: "hse.feature.hierarchy_of_controls", label: "Hierarchy of Controls", level: "FEATURE", parent: "hse" },
  { key: "hse.feature.work_start_gate", label: "Work-Start Safety Gate", level: "FEATURE", parent: "hse" },
  { key: "hse.action.create_hazard", label: "Log Hazard", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_risk_assessment", label: "Create Risk Assessment", level: "ACTION", parent: "hse" },
  { key: "hse.action.issue_permit", label: "Issue Permit to Work", level: "ACTION", parent: "hse" },
  { key: "hse.action.stop_work", label: "Issue Stop Work Order", level: "ACTION", parent: "hse" },
  { key: "hse.action.release_stop_work", label: "Release Stop Work Order", level: "ACTION", parent: "hse" },
];

const NODE_BY_KEY = new Map(CONFIG_NODES.map((n) => [n.key, n]));

export function getConfigNode(key: string): ConfigNode | undefined {
  return NODE_BY_KEY.get(key);
}

/** Walks parent links to the module root. Nearest ancestor first. */
export function getAncestorKeys(key: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([key]);
  let cursor = NODE_BY_KEY.get(key)?.parent;
  while (cursor && !seen.has(cursor)) {
    chain.push(cursor);
    seen.add(cursor);
    cursor = NODE_BY_KEY.get(cursor)?.parent;
  }
  return chain;
}

export type ConfigOverrides = {
  /** Tenant-wide rows: nodeKey -> enabled. */
  tenant: Record<string, boolean>;
  /** Company-specific rows, which win over the tenant row. */
  company?: Record<string, boolean>;
};

/**
 * Effective state of one node.
 *
 * Precedence, nearest wins: company override > tenant override > catalog
 * default (enabled). A node is then disabled if **any ancestor** resolves to
 * disabled — that cascade is what makes "disabled functionality disappears
 * from navigation, search, APIs and layouts" hold without every call site
 * having to check each parent itself.
 */
export function isConfigEnabled(key: string, overrides: ConfigOverrides): boolean {
  const ownState = (k: string): boolean => {
    if (overrides.company && k in overrides.company) return overrides.company[k]!;
    if (k in overrides.tenant) return overrides.tenant[k]!;
    return NODE_BY_KEY.get(k)?.defaultEnabled ?? true;
  };

  if (!ownState(key)) return false;
  for (const ancestor of getAncestorKeys(key)) {
    if (!ownState(ancestor)) return false;
  }
  return true;
}

/** Convenience for building a lookup once and reusing it across a render. */
export function buildConfigResolver(overrides: ConfigOverrides) {
  const cache = new Map<string, boolean>();
  return (key: string) => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = isConfigEnabled(key, overrides);
    cache.set(key, value);
    return value;
  };
}

export type ConfigResolver = ReturnType<typeof buildConfigResolver>;

/**
 * Routes that must not appear in navigation or resolve in search, given the
 * current overrides. Any PAGE node that is disabled (directly or by cascade)
 * contributes its route.
 */
export function disabledRoutes(overrides: ConfigOverrides): string[] {
  const resolve = buildConfigResolver(overrides);
  return CONFIG_NODES.filter((n) => n.route && !resolve(n.key)).map((n) => n.route!);
}
