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
  // --- Assets (PRD_Assets_Module) -------------------------------------------
  { key: "assets", label: "Assets", level: "MODULE" },
  { key: "assets.page.dashboard", label: "Assets Dashboard", level: "PAGE", parent: "assets", route: "/dashboard/assets" },
  { key: "assets.page.register", label: "Asset Register", level: "PAGE", parent: "assets", route: "/dashboard/assets/register" },
  { key: "assets.page.detail", label: "Asset Page", level: "PAGE", parent: "assets" },
  { key: "assets.page.work_orders", label: "Asset Work Orders", level: "PAGE", parent: "assets", route: "/dashboard/assets/work-orders" },
  { key: "assets.page.compliance", label: "Inspections and Compliance", level: "PAGE", parent: "assets", route: "/dashboard/assets/compliance" },
  { key: "assets.page.categories", label: "Asset Categories", level: "PAGE", parent: "assets", route: "/dashboard/assets/categories" },
  { key: "assets.page.reports", label: "Asset Reports", level: "PAGE", parent: "assets", route: "/dashboard/assets/reports" },
  { key: "assets.section.financial", label: "Asset Financial Summary", level: "SECTION", parent: "assets.page.detail" },
  { key: "assets.section.identifiers", label: "QR Barcode RFID", level: "SECTION", parent: "assets.page.detail" },
  { key: "assets.feature.reservations", label: "Asset Reservations", level: "FEATURE", parent: "assets" },
  { key: "assets.feature.calibration", label: "Asset Calibration", level: "FEATURE", parent: "assets" },
  { key: "assets.action.create", label: "Create Asset", level: "ACTION", parent: "assets" },
  { key: "assets.action.assign", label: "Assign Asset", level: "ACTION", parent: "assets" },
  { key: "assets.action.transfer", label: "Transfer Asset", level: "ACTION", parent: "assets" },
  { key: "assets.action.create_work_order", label: "Create Work Order", level: "ACTION", parent: "assets" },
  { key: "assets.report.register", label: "Asset Register Report", level: "REPORT", parent: "assets" },
  { key: "assets.report.depreciation", label: "Depreciation Report", level: "REPORT", parent: "assets" },
  { key: "assets.report.maintenance", label: "Maintenance and Downtime Report", level: "REPORT", parent: "assets" },

  // --- Procurement (PRD_Procurement_Module v1.0) --------------------------
  { key: "procurement", label: "Procurement", level: "MODULE" },
  { key: "procurement.page.dashboard", label: "Procurement Dashboard", level: "PAGE", parent: "procurement", route: "/dashboard/procurement" },
  { key: "procurement.page.workspace", label: "Procurement Workspace", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/workspace" },
  { key: "procurement.page.suppliers", label: "Supplier Directory", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/suppliers" },
  { key: "procurement.page.requests", label: "Purchase Requests", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/requests" },
  { key: "procurement.page.packages", label: "Procurement Packages", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/packages" },
  { key: "procurement.page.sourcing", label: "RFQs and Sourcing", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/sourcing" },
  { key: "procurement.page.orders", label: "Purchase Orders", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/orders" },
  { key: "procurement.page.deliveries", label: "Deliveries", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/deliveries" },
  { key: "procurement.section.dashboard_kpis", label: "Dashboard KPIs", level: "SECTION", parent: "procurement.page.dashboard" },
  { key: "procurement.section.exceptions", label: "Exceptions", level: "SECTION", parent: "procurement.page.dashboard" },
  { key: "procurement.feature.qualifications", label: "Supplier Qualification", level: "FEATURE", parent: "procurement" },
  { key: "procurement.feature.comparison", label: "Quotation Comparison", level: "FEATURE", parent: "procurement" },
  { key: "procurement.feature.delivery_exceptions", label: "Delivery Exceptions", level: "FEATURE", parent: "procurement" },
  { key: "procurement.action.create_supplier", label: "Create Supplier", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.create_request", label: "Create Purchase Request", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.issue_rfq", label: "Issue RFQ", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.issue_order", label: "Issue Purchase Order", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.record_delivery", label: "Record Delivery", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.manage_categories", label: "Manage Supplier Categories", level: "ACTION", parent: "procurement" },
  { key: "procurement.action.manage_documents", label: "Manage Supplier Documents", level: "ACTION", parent: "procurement" },
  { key: "procurement.page.documents", label: "Supplier Document Renewal", level: "PAGE", parent: "procurement", route: "/dashboard/procurement/documents" },
  { key: "procurement.report.spend", label: "Procurement Spend", level: "REPORT", parent: "procurement" },
  { key: "procurement.report.supplier_performance", label: "Supplier Performance", level: "REPORT", parent: "procurement" },
  { key: "work_progress", label: "Work Progress and Site Operations", level: "MODULE" },
  { key: "work_progress.page.dashboard", label: "Work Progress Dashboard", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress" },
  { key: "work_progress.page.packages", label: "Work Packages", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/packages" },
  { key: "work_progress.page.schedule", label: "Schedule and Baselines", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/schedule" },
  { key: "work_progress.page.daily_reports", label: "Daily Site Reports", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/daily-reports" },
  { key: "work_progress.page.control", label: "Constraints and Delays", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/control" },
  { key: "work_progress.page.evidence", label: "Progress Evidence", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/evidence" },
  { key: "work_progress.page.measurement", label: "Measurement and Certification", level: "PAGE", parent: "work_progress", route: "/dashboard/work-progress/measurement" },
  { key: "work_progress.section.kpis", label: "Progress KPIs", level: "SECTION", parent: "work_progress.page.dashboard" },
  { key: "work_progress.feature.offline_capture", label: "Offline Field Capture", level: "FEATURE", parent: "work_progress" },
  { key: "work_progress.feature.quality_gates", label: "Quality Readiness Gates", level: "FEATURE", parent: "work_progress" },
  { key: "work_progress.feature.hse_gates", label: "HSE Readiness Gates", level: "FEATURE", parent: "work_progress" },
  { key: "work_progress.action.create_package", label: "Create Work Package", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.capture_progress", label: "Capture Progress", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.create_daily_report", label: "Create Daily Report", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.create_constraint", label: "Create Constraint", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.create_delay", label: "Record Delay", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.create_schedule", label: "Create Schedule Version and Activities", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.activate_baseline", label: "Activate Baseline", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.log_evidence", label: "Log Progress Evidence", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.action.verify_progress", label: "Verify or Reject Progress Claim", level: "ACTION", parent: "work_progress" },
  { key: "work_progress.report.daily", label: "Daily Progress Report", level: "REPORT", parent: "work_progress" },
  { key: "work_progress.report.monthly", label: "Monthly Progress Report", level: "REPORT", parent: "work_progress" },

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
  { key: "hr.page.recruitment", label: "Recruitment", level: "PAGE", parent: "hr", route: "/dashboard/hr/recruitment" },
  { key: "hr.page.vacancy_detail", label: "Vacancy Page", level: "PAGE", parent: "hr", route: "/dashboard/hr/recruitment/[id]" },
  { key: "hr.action.manage_vacancy", label: "Manage Vacancy", level: "ACTION", parent: "hr" },
  { key: "hr.action.manage_candidate", label: "Manage Candidate", level: "ACTION", parent: "hr" },
  { key: "hr.action.manage_offer", label: "Manage Offer", level: "ACTION", parent: "hr" },
  { key: "hr.page.attendance", label: "Attendance & Scheduling", level: "PAGE", parent: "hr", route: "/dashboard/hr/attendance" },
  { key: "hr.action.manage_schedule", label: "Manage Shift Schedule", level: "ACTION", parent: "hr" },
  { key: "hr.action.clock_attendance", label: "Clock In/Out", level: "ACTION", parent: "hr" },

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
  { key: "legal.page.cases", label: "Legal Cases", level: "PAGE", parent: "legal", route: "/dashboard/legal/cases" },
  { key: "legal.page.case_detail", label: "Case Page", level: "PAGE", parent: "legal", route: "/dashboard/legal/cases/[id]" },
  { key: "legal.page.holds", label: "Legal Holds", level: "PAGE", parent: "legal", route: "/dashboard/legal/holds" },
  { key: "legal.feature.case_access_grants", label: "Per-Case Access Grants", level: "FEATURE", parent: "legal" },
  { key: "legal.action.manage_case", label: "Manage Legal Case", level: "ACTION", parent: "legal" },
  { key: "legal.action.manage_hold", label: "Manage Legal Hold", level: "ACTION", parent: "legal" },

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
  { key: "hse.page.inspections", label: "Inspections & Observations", level: "PAGE", parent: "hse", route: "/dashboard/hse/inspections" },
  { key: "hse.page.observations", label: "Observations", level: "PAGE", parent: "hse", route: "/dashboard/hse/observations" },
  { key: "hse.page.incidents", label: "Incidents & Investigations", level: "PAGE", parent: "hse", route: "/dashboard/hse/incidents" },
  { key: "hse.page.incident_detail", label: "Incident Page", level: "PAGE", parent: "hse", route: "/dashboard/hse/incidents/[id]" },
  { key: "hse.page.inductions", label: "Inductions & Toolbox Talks", level: "PAGE", parent: "hse", route: "/dashboard/hse/inductions" },
  { key: "hse.page.emergency", label: "Emergency Contacts", level: "PAGE", parent: "hse", route: "/dashboard/hse/emergency" },
  { key: "hse.action.create_inspection", label: "Log Inspection", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_observation", label: "Report Observation", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_incident", label: "Report Incident", level: "ACTION", parent: "hse" },
  { key: "hse.action.close_incident", label: "Close Incident", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_corrective_action", label: "Raise Corrective Action", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_induction", label: "Record Induction", level: "ACTION", parent: "hse" },
  { key: "hse.action.create_toolbox_talk", label: "Record Toolbox Talk", level: "ACTION", parent: "hse" },
  { key: "hse.action.manage_emergency_contacts", label: "Manage Emergency Contacts", level: "ACTION", parent: "hse" },

  { key: "analytics", label: "Analytics and Reporting", level: "MODULE" },
  { key: "analytics.page.overview", label: "Analytics Overview", level: "PAGE", parent: "analytics", route: "/analytics" },
  { key: "analytics.page.reports", label: "Report Library", level: "PAGE", parent: "analytics", route: "/analytics/reports" },
  { key: "analytics.action.create_report", label: "Create Saved Report", level: "ACTION", parent: "analytics" },

  { key: "bim", label: "BIM and Digital Twin (Registry)", level: "MODULE" },
  { key: "bim.page.models", label: "BIM Model Registry", level: "PAGE", parent: "bim", route: "/dashboard/bim" },
  { key: "bim.page.model_detail", label: "BIM Model Page", level: "PAGE", parent: "bim", route: "/dashboard/bim/[id]" },
  { key: "bim.action.register_model", label: "Register Model", level: "ACTION", parent: "bim" },
  { key: "bim.action.upload_version", label: "Register Model Version", level: "ACTION", parent: "bim" },
  { key: "bim.action.link_object", label: "Link Model to Record", level: "ACTION", parent: "bim" },

  // PRD_Approvals_Workflow_Engine — Phase 1 (sequential routing only).
  { key: "workflow", label: "Approvals and Workflow Engine", level: "MODULE" },
  { key: "workflow.page.inbox", label: "My Approvals", level: "PAGE", parent: "workflow", route: "/workflows" },
  { key: "workflow.page.definitions", label: "Workflow Definitions", level: "PAGE", parent: "workflow", route: "/dashboard/admin/workflows" },
  { key: "workflow.action.create_definition", label: "Create Workflow Definition", level: "ACTION", parent: "workflow" },
  { key: "workflow.action.decide", label: "Decide Work Item", level: "ACTION", parent: "workflow" },
  { key: "workflow.action.cancel", label: "Cancel Workflow Instance", level: "ACTION", parent: "workflow" },

  // PRD_IT_Administration_Integrations_Service_Management — Phase 1 "IT
  // Foundation" only (no external SSO/M365/Google/webhook adapters).
  { key: "it_admin", label: "IT Administration", level: "MODULE" },
  { key: "it_admin.page.dashboard", label: "IT Dashboard", level: "PAGE", parent: "it_admin", route: "/dashboard/admin/it" },
  { key: "it_admin.page.devices", label: "Device Registry", level: "PAGE", parent: "it_admin", route: "/dashboard/admin/it/devices" },
  { key: "it_admin.page.licences", label: "Software Licences", level: "PAGE", parent: "it_admin", route: "/dashboard/admin/it/licences" },
  { key: "it_admin.page.tickets", label: "Service Desk", level: "PAGE", parent: "it_admin", route: "/dashboard/admin/it/tickets" },
  { key: "it_admin.page.ticket_detail", label: "Ticket Page", level: "PAGE", parent: "it_admin", route: "/dashboard/admin/it/tickets/[id]" },
  { key: "it_admin.action.manage_devices", label: "Manage Devices", level: "ACTION", parent: "it_admin" },
  { key: "it_admin.action.manage_licences", label: "Manage Licences", level: "ACTION", parent: "it_admin" },
  { key: "it_admin.action.create_ticket", label: "Create Service Ticket", level: "ACTION", parent: "it_admin" },
  { key: "it_admin.action.manage_ticket", label: "Manage Service Ticket", level: "ACTION", parent: "it_admin" },

  // PRD_Mobile_Offline_Platform — Phase 1 "Responsive foundation" only (device
  // registration + online-only access; no offline sync engine).
  { key: "mobile_access", label: "Mobile Device Access", level: "MODULE" },
  { key: "mobile_access.page.my_devices", label: "My Devices", level: "PAGE", parent: "mobile_access", route: "/account/devices" },
  { key: "mobile_access.page.admin", label: "Device Access Admin", level: "PAGE", parent: "mobile_access", route: "/dashboard/admin/devices" },
  { key: "mobile_access.action.register_device", label: "Register Device", level: "ACTION", parent: "mobile_access" },
  { key: "mobile_access.action.revoke_device", label: "Revoke Device", level: "ACTION", parent: "mobile_access" },

  // PRD_Client_Supplier_Portals — Phase 1 "Shared foundation" only, scoped to
  // reuse the existing CLIENT/CONTRACTOR login rather than a second auth system.
  { key: "portal_access", label: "Client & Supplier Portal Access", level: "MODULE" },
  { key: "portal_access.page.admin", label: "External Organizations", level: "PAGE", parent: "portal_access", route: "/dashboard/admin/portal-access" },
  { key: "portal_access.action.create_org", label: "Register External Organization", level: "ACTION", parent: "portal_access" },
  { key: "portal_access.action.manage_membership", label: "Manage Portal Membership", level: "ACTION", parent: "portal_access" },
  { key: "portal_access.action.grant_project_access", label: "Grant Project Access", level: "ACTION", parent: "portal_access" },
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
