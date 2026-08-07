import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  ShieldCheck,
  UserCog,
  UsersRound,
  Mail,
  Building2,
  CreditCard,
  Plug,
  Lock,
  ScrollText,
  Wallet,
  Receipt,
  BookText,
  ArrowRightLeft,
  PieChart,
  TrendingUp,
  TrendingDown,
  Coins,
  Calculator,
  Boxes,
  Percent,
  UserPlus,
  ClipboardList,
  CalendarClock,
  GraduationCap,
  BarChart3,
  Ruler,
  FilePenLine,
  HelpCircle,
  ClipboardCheck,
  CalendarDays,
  Handshake,
  ShieldAlert,
  Eye,
  AlertOctagon,
  PhoneCall,
  Bell,
  Box,
  Truck,
  PackageOpen,
  Workflow,
  Contact,
  SlidersHorizontal,
  Landmark,
  CalendarRange,
  NotebookPen,
  Inbox,
  Laptop,
  Smartphone,
  Network,
  Scale,
  Megaphone,
  UploadCloud,
  ListChecks,
  Warehouse,
  PackageCheck,
  PackageMinus,
  ArrowLeftRight,
  RotateCcw,
  Timer,
  AlertTriangle,
  ClipboardPen,
  Briefcase,
  UserCheck,
  Target,
  LogOut,
  Globe,
  Award,
  Repeat,
  Undo2,
  FlaskConical,
  Wrench,
  Bug,
  Zap,
} from "lucide-react";
import { can, DASHBOARD_BY_ROLE, type Resource, type Level } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import type { ModuleKey } from "@/lib/modules";

// `labelKey`/`titleKey` are dot-paths into the i18n dictionary (see
// src/lib/i18n/messages/*.json under the "nav" namespace) — resolved at
// render time via useI18n() so the sidebar re-renders in the active locale.
//
// `resource`/`level` mirror the exact `can(role, resource, level)` gate the
// destination page enforces (see the redirect at the top of each page
// component) — kept in lockstep on purpose so the sidebar never advertises a
// link a role would immediately get redirected away from. Items with no
// `resource` are universally reachable (own dashboard home, Projects, Work
// Inbox, Account, Help — none of these gate by role).
export type NavItem = { labelKey: string; href: string; icon: LucideIcon; resource?: Resource; level?: Level; moduleKey?: ModuleKey };
export type NavSection = { titleKey?: string; items: NavItem[] };

// Fixed, role-specific sidebar sections — DAS-001 (no widget/nav rearranging
// in V1) and matches the approved visual references' per-dashboard sidebars.
export const NAV_SECTIONS: Record<string, NavSection[]> = {
  executive: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/executive", icon: LayoutDashboard },
        { labelKey: "nav.myApprovals", href: "/workflows", icon: Inbox },
        { labelKey: "nav.announcements", href: "/announcements", icon: Megaphone },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
        { labelKey: "nav.myPayslips", href: "/dashboard/hr/payroll/my-payslips", icon: Wallet },
      ],
    },
    {
      titleKey: "nav.operations",
      items: [
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.workProgress", href: "/dashboard/work-progress", icon: ClipboardCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.assets", href: "/dashboard/assets", icon: Boxes, resource: "PROJECTS", moduleKey: "ASSETS" },
        { labelKey: "nav.bim", href: "/dashboard/bim", icon: Box, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.taskOrchestration", href: "/tasks/orchestration", icon: Workflow, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.contracts", href: "/contracts", icon: FileText, resource: "CONTRACTS", moduleKey: "CONTRACTS" },
        { labelKey: "nav.documents", href: "/documents", icon: BookText, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.meetings", href: "/meetings", icon: CalendarDays, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.hse", href: "/dashboard/hse", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
      ],
    },
    {
      titleKey: "nav.business",
      items: [
        { labelKey: "nav.crm", href: "/clients", icon: Handshake, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.finance", href: "/dashboard/finance", icon: Wallet, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.hr", href: "/dashboard/hr", icon: Users, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.payroll", href: "/dashboard/hr/payroll", icon: Wallet, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.legal", href: "/dashboard/legal", icon: FileText, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.procurement", href: "/dashboard/procurement", icon: Truck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK", moduleKey: "COMPANY_NETWORK" },
        { labelKey: "nav.reports", href: "/reports", icon: BarChart3, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.analytics", href: "/analytics", icon: TrendingUp, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.companySection",
      items: [
        { labelKey: "nav.company", href: "/company", icon: Building2, resource: "COMPANY_SETTINGS" },
        { labelKey: "nav.administration", href: "/dashboard/admin", icon: ShieldCheck, resource: "USER_MANAGEMENT" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/admin", icon: LayoutDashboard, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.myApprovals", href: "/workflows", icon: Inbox },
        { labelKey: "nav.announcements", href: "/announcements", icon: Megaphone },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.userManagement",
      items: [
        { labelKey: "nav.users", href: "/dashboard/admin/users", icon: Users, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.rolesPermissions", href: "/dashboard/admin/roles", icon: ShieldCheck, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.teams", href: "/dashboard/admin/teams", icon: UsersRound, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.invitations", href: "/dashboard/admin/invitations", icon: Mail, resource: "USER_MANAGEMENT" },
      ],
    },
    {
      titleKey: "nav.companySettings",
      items: [
        { labelKey: "nav.companyProfile", href: "/company", icon: Building2, resource: "COMPANY_SETTINGS" },
        { labelKey: "nav.subscription", href: "/dashboard/admin/subscription", icon: CreditCard, resource: "USER_MANAGEMENT" },
        // Platform Configuration — deliberately gated on COMPANY_SETTINGS, the
        // same gate the page and the toggle action enforce.
        { labelKey: "nav.platformConfiguration", href: "/dashboard/admin/configuration", icon: SlidersHorizontal, resource: "COMPANY_SETTINGS", level: "FULL" },
        { labelKey: "nav.integrations", href: "/dashboard/admin/integrations", icon: Plug, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.security", href: "/dashboard/admin/security", icon: Lock, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.auditLogs", href: "/dashboard/admin/audit", icon: ScrollText, resource: "AUDIT_LOGS" },
        { labelKey: "nav.eventCentre", href: "/dashboard/admin/event-centre", icon: Bell, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.workflowDefinitions", href: "/dashboard/admin/workflows", icon: Workflow, resource: "COMPANY_SETTINGS", level: "FULL" },
        { labelKey: "nav.itAdmin", href: "/dashboard/admin/it", icon: Laptop, resource: "COMPANY_SETTINGS", level: "FULL" },
        { labelKey: "nav.deviceAccess", href: "/dashboard/admin/devices", icon: Smartphone, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.portalAccess", href: "/dashboard/admin/portal-access", icon: Network, resource: "COMPANY_SETTINGS", level: "FULL" },
        { labelKey: "nav.importCenter", href: "/dashboard/admin/import", icon: UploadCloud },
        { labelKey: "nav.setupCenter", href: "/dashboard/admin/setup", icon: ListChecks, resource: "COMPANY_SETTINGS", level: "FULL" },
      ],
    },
  ],
  // PRD_Finance_Dashboard §4 — exact, locked v1 Finance sidebar. Do not add,
  // infer or substitute items without a PRD revision (§27 "Explicitly Not
  // Allowed"). Spendings/Projects stay near the top per the PRD's own note
  // that they're daily operational Finance work.
  finance: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/finance", icon: LayoutDashboard, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.spendings", href: "/dashboard/finance/spendings", icon: CreditCard, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.financeProjects",
      items: [
        { labelKey: "nav.allProjects", href: "/dashboard/finance/projects", icon: FolderKanban, resource: "FINANCE", moduleKey: "FINANCE" },
        // Same destination as "All Projects" (§5.1's Select Project picker
        // lives there) — a distinct href only so the sidebar's per-item
        // React key stays unique; not a second page.
        { labelKey: "nav.projectFinance", href: "/dashboard/finance/projects?scope=project", icon: Wallet, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.accountingCore",
      items: [
        { labelKey: "nav.chartOfAccounts", href: "/dashboard/finance/accounts", icon: Landmark, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.generalLedger", href: "/dashboard/finance/ledger", icon: BookText, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.journalEntries", href: "/dashboard/finance/journal", icon: NotebookPen, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.fiscalPeriods", href: "/dashboard/finance/periods", icon: CalendarRange, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.cashBanking",
      items: [
        { labelKey: "nav.banking", href: "/dashboard/finance/banking", icon: Landmark, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.bankReconciliation", href: "/dashboard/finance/reconciliation", icon: ArrowRightLeft, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.receivablesPayables",
      items: [
        { labelKey: "nav.receivables", href: "/dashboard/finance/receivables", icon: TrendingUp, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.payables", href: "/dashboard/finance/payables", icon: TrendingDown, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.invoices", href: "/dashboard/finance/invoices", icon: FileText, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.bills", href: "/dashboard/finance/bills", icon: Receipt, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.payments", href: "/dashboard/finance/payments", icon: ArrowRightLeft, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.planning",
      items: [
        { labelKey: "nav.budgets", href: "/dashboard/finance/budgets", icon: PieChart, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.forecasting", href: "/dashboard/finance/forecast", icon: TrendingUp, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.costCenters", href: "/dashboard/finance/cost-centers", icon: Boxes, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.revenue", href: "/dashboard/finance/revenue", icon: TrendingUp, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.expenses", href: "/dashboard/finance/expenses", icon: TrendingDown, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.connectedFinance",
      items: [
        { labelKey: "nav.unitFinance", href: "/dashboard/finance/units", icon: Building2, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.contractFinance", href: "/dashboard/finance/contracts", icon: ScrollText, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.procurementFinance", href: "/dashboard/finance/procurement", icon: Truck, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.payrollSummary", href: "/dashboard/finance/payroll", icon: Wallet, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.assetsFinance", href: "/dashboard/finance/assets", icon: Boxes, resource: "PROJECTS", moduleKey: "ASSETS" },
      ],
    },
    {
      titleKey: "nav.other",
      items: [
        { labelKey: "nav.loans", href: "/dashboard/finance/loans", icon: Coins, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.investments", href: "/dashboard/finance/investments", icon: Coins, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.taxManagement", href: "/dashboard/finance/tax", icon: Percent, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.reporting",
      items: [
        { labelKey: "nav.financialStatements", href: "/dashboard/finance/statements", icon: FileText, resource: "FINANCE", moduleKey: "FINANCE" },
        // Same destination as the top "Dashboard" item (§6.1's KPI cards are
        // the Company Overview) — distinct href only for a unique sidebar key.
        { labelKey: "nav.kpiDashboard", href: "/dashboard/finance?view=kpi", icon: BarChart3, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.reports", href: "/reports", icon: BarChart3, resource: "PROJECTS" },
        { labelKey: "nav.auditLogs", href: "/dashboard/admin/audit", icon: ScrollText, resource: "AUDIT_LOGS" },
      ],
    },
    {
      titleKey: "nav.settingsSection",
      items: [{ labelKey: "nav.financeSettings", href: "/dashboard/finance/settings", icon: SlidersHorizontal, resource: "FINANCE", moduleKey: "FINANCE" }],
    },
  ],
  // PRD_HR_Dashboard §4 — reworked to the full hierarchy: PEOPLE / RECRUITMENT
  // / WORKFORCE / PAYROLL & REWARDS / DEVELOPMENT / EMPLOYEE RELATIONS, then
  // Documents/Reports/Settings. Additive over the Phase-1 HR build — every
  // pre-existing route (employees, recruitment, attendance, leave, training,
  // payroll, reports) is kept, just regrouped; every new leaf is a real,
  // thin page (see module_prd_conventions — no dead links).
  hr: [
    {
      items: [{ labelKey: "nav.overview", href: "/dashboard/hr", icon: LayoutDashboard, resource: "HR", moduleKey: "HR" }],
    },
    {
      titleKey: "nav.people",
      items: [
        { labelKey: "nav.employees", href: "/dashboard/hr/employees", icon: Users, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.organisation", href: "/dashboard/hr/organisation", icon: Building2, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.positions", href: "/dashboard/hr/positions", icon: Briefcase, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.employmentContracts", href: "/dashboard/hr/contracts", icon: ScrollText, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.recruitment",
      items: [
        { labelKey: "nav.vacancies", href: "/dashboard/hr/recruitment", icon: UserPlus, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.candidates", href: "/dashboard/hr/candidates", icon: Contact, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.onboarding", href: "/dashboard/hr/onboarding", icon: UserCheck, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.workforce",
      items: [
        { labelKey: "nav.calendar", href: "/dashboard/hr/calendar", icon: CalendarDays, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.attendance", href: "/dashboard/hr/attendance", icon: ClipboardList, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.shiftsAndRosters", href: "/dashboard/hr/shifts", icon: CalendarRange, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.timesheets", href: "/dashboard/hr/timesheets", icon: Timer, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.leaveRequests", href: "/dashboard/hr/leave", icon: CalendarClock, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.workforcePlanning", href: "/dashboard/hr/workforce-planning", icon: BarChart3, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.payrollAndRewards",
      items: [
        { labelKey: "nav.payroll", href: "/dashboard/hr/payroll", icon: Wallet, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.myPayslips", href: "/dashboard/hr/payroll/my-payslips", icon: Wallet },
        { labelKey: "nav.compensationAndBenefits", href: "/dashboard/hr/compensation", icon: Coins, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.expensesAndReimbursements", href: "/dashboard/hr/expenses", icon: Receipt, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.development",
      items: [
        { labelKey: "nav.training", href: "/dashboard/hr/training", icon: GraduationCap, resource: "HR", moduleKey: "TRAINING" },
        { labelKey: "nav.performance", href: "/dashboard/hr/performance", icon: Target, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.employeeRelations",
      items: [
        { labelKey: "nav.disciplinaryAndGrievances", href: "/dashboard/hr/disciplinary", icon: AlertOctagon, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.offboarding", href: "/dashboard/hr/offboarding", icon: LogOut, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.externalWorkforce", href: "/dashboard/hr/external-workforce", icon: Globe, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      items: [
        { labelKey: "nav.documents", href: "/dashboard/hr/documents", icon: FileText, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.reports", href: "/dashboard/hr/reports", icon: BarChart3, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.hrSettings", href: "/dashboard/hr/settings", icon: SlidersHorizontal, resource: "HR", moduleKey: "HR" },
      ],
    },
  ],
  // PRD_Inventory_Dashboard §4 — exact sidebar. Inventory has no dedicated
  // permission Resource yet — every item gates on PROCUREMENT (the closest
  // existing resource, same reasoning as inventory-module.ts's actions).
  inventory: [
    {
      items: [{ labelKey: "nav.dashboard", href: "/dashboard/inventory", icon: LayoutDashboard, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" }],
    },
    {
      titleKey: "nav.stock",
      items: [
        { labelKey: "nav.products", href: "/dashboard/inventory/products", icon: Box, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.stockLevels", href: "/dashboard/inventory/stock", icon: Boxes, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.warehouses", href: "/dashboard/inventory/warehouses", icon: Warehouse, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.operations",
      items: [
        { labelKey: "nav.receiving", href: "/dashboard/inventory/receiving", icon: PackageCheck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.goodsIssues", href: "/dashboard/inventory/issues", icon: PackageMinus, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.transfers", href: "/dashboard/inventory/transfers", icon: ArrowLeftRight, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.returns", href: "/dashboard/inventory/returns", icon: RotateCcw, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.reservations", href: "/dashboard/inventory/reservations", icon: CalendarRange, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.control",
      items: [
        { labelKey: "nav.counts", href: "/dashboard/inventory/counts", icon: ClipboardPen, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.reorder", href: "/dashboard/inventory/reorder", icon: AlertTriangle, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.expiration", href: "/dashboard/inventory/expiration", icon: Timer, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.reporting",
      items: [
        { labelKey: "nav.valuation", href: "/dashboard/inventory/valuation", icon: Calculator, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.reports", href: "/dashboard/inventory/reports", icon: BarChart3, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.settings",
      items: [{ labelKey: "nav.inventorySettings", href: "/dashboard/inventory/settings", icon: SlidersHorizontal, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" }],
    },
  ],
  // PRD_Sales_Dashboard §6 — exact, locked Sales sidebar. Do not add, infer
  // or substitute items without a PRD revision (§33 "Explicitly Not Allowed").
  sales: [
    {
      items: [{ labelKey: "nav.dashboard", href: "/dashboard/sales", icon: LayoutDashboard, resource: "CLIENTS", moduleKey: "CLIENTS" }],
    },
    {
      titleKey: "nav.crm",
      items: [
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.contacts", href: "/clients/contacts", icon: Contact, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.leads", href: "/clients/leads", icon: UserPlus, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.opportunities", href: "/clients/opportunities", icon: TrendingUp, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.salesPipeline", href: "/clients/pipeline", icon: PieChart, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.reservations", href: "/clients/reservations", icon: CalendarRange, resource: "CLIENTS", moduleKey: "CLIENTS" },
      ],
    },
    {
      titleKey: "nav.sales",
      items: [
        { labelKey: "nav.units", href: "/units", icon: Building2, resource: "PROJECTS" },
        { labelKey: "nav.contracts", href: "/contracts", icon: ScrollText, resource: "CONTRACTS", moduleKey: "CONTRACTS" },
        { labelKey: "nav.payments", href: "/clients/payments", icon: Wallet, resource: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.work",
      items: [
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.meetings", href: "/meetings", icon: CalendarDays },
        { labelKey: "nav.communications", href: "/clients/communications", icon: PhoneCall, resource: "CLIENTS", moduleKey: "CLIENTS" },
      ],
    },
    {
      titleKey: "nav.afterSales",
      items: [{ labelKey: "nav.support", href: "/clients/support", icon: HelpCircle, resource: "CLIENTS", moduleKey: "CLIENTS" }],
    },
    {
      titleKey: "nav.analytics",
      items: [{ labelKey: "nav.reports", href: "/reports", icon: BarChart3, resource: "PROJECTS" }],
    },
  ],
  // PRD_Architect_Dashboard §4.2 — exact, locked v1 Architecture sidebar.
  architect: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/architect", icon: LayoutDashboard, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
    {
      titleKey: "nav.design",
      items: [
        { labelKey: "nav.drawings", href: "/dashboard/architect/drawings", icon: Ruler, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.revisions", href: "/dashboard/architect/revisions", icon: FilePenLine, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.rfis", href: "/dashboard/architect/rfis", icon: HelpCircle, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.submittals", href: "/dashboard/architect/submittals", icon: UploadCloud, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.coordination",
      items: [
        { labelKey: "nav.approvals", href: "/dashboard/architect/approvals", icon: ClipboardCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.clientRequests", href: "/dashboard/architect/client-requests", icon: Contact, resource: "CLIENTS", moduleKey: "CLIENTS" },
      ],
    },
    {
      titleKey: "nav.work",
      items: [
        { labelKey: "nav.documents", href: "/documents", icon: BookText, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.bim", href: "/dashboard/bim", icon: Box, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.calendar", href: "/calendar", icon: CalendarDays, resource: "PROJECTS" },
      ],
    },
  ],
  // PRD_Engineer_Dashboard §4.2 — exact, locked v1 Engineering sidebar.
  engineering: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/engineering", icon: LayoutDashboard, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
    {
      titleKey: "nav.technical",
      items: [
        { labelKey: "nav.engineeringPackages", href: "/dashboard/engineering/packages", icon: ClipboardList, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.specifications", href: "/dashboard/engineering/specifications", icon: FileText, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.calculations", href: "/dashboard/engineering/calculations", icon: Calculator, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.rfis", href: "/dashboard/engineering/rfis", icon: HelpCircle, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.submittals", href: "/dashboard/engineering/submittals", icon: UploadCloud, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.siteCoordination",
      items: [
        { labelKey: "nav.inspections", href: "/dashboard/engineering/inspections", icon: ShieldCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.coordination", href: "/dashboard/engineering/coordination", icon: Network, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.approvals", href: "/dashboard/engineering/approvals", icon: ClipboardCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.work",
      items: [
        { labelKey: "nav.documents", href: "/documents", icon: BookText, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.bim", href: "/dashboard/bim", icon: Box, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.calendar", href: "/calendar", icon: CalendarDays, resource: "PROJECTS" },
      ],
    },
  ],
  // PRD_Government_Legal_Compliance — the LEGAL role's own console.
  legal: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/legal", icon: LayoutDashboard, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.compliance",
      items: [
        { labelKey: "nav.permits", href: "/dashboard/legal/permits", icon: FileText, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.legalCases", href: "/dashboard/legal/cases", icon: Scale, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.legalHolds", href: "/dashboard/legal/holds", icon: Lock, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.contracts", href: "/contracts", icon: FileText, resource: "CONTRACTS", moduleKey: "CONTRACTS" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK", moduleKey: "COMPANY_NETWORK" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
  ],
  // PRD_HSE_Module — the HSE role's own console. Reuses the HSE_REPORTS
  // resource/moduleKey for gating, same as every existing HSE nav item.
  hse: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/hse", icon: LayoutDashboard, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.safety",
      items: [
        { labelKey: "nav.hazards", href: "/dashboard/hse/hazards", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.permitsToWork", href: "/dashboard/hse/permits", icon: FileText, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.stopWork", href: "/dashboard/hse/stop-work", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.inspections", href: "/dashboard/hse/inspections", icon: ClipboardCheck, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.observations", href: "/dashboard/hse/observations", icon: Eye, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.incidents", href: "/dashboard/hse/incidents", icon: AlertOctagon, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.inductions", href: "/dashboard/hse/inductions", icon: GraduationCap, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.emergencyContacts", href: "/dashboard/hse/emergency", icon: PhoneCall, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
  ],
  // PRD_Procurement_Dashboard §3.2 — exact, locked v1 sidebar. Existing
  // Phase-1 routes (requests/packages/sourcing/suppliers/documents/orders/
  // deliveries/workspace) are kept and regrouped, never rewritten; only the
  // Comparison/Award/Framework/Receipts/Returns/Qualification/Performance
  // leaves are genuinely new.
  procurement: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/procurement", icon: LayoutDashboard, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.myWork", href: "/dashboard/procurement/my-work", icon: Inbox, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.exceptions", href: "/dashboard/procurement/exceptions", icon: AlertTriangle, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.demand",
      items: [
        { labelKey: "nav.purchaseRequests", href: "/dashboard/procurement/requests", icon: ClipboardList, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.replenishmentRequests", href: "/dashboard/procurement/requests/replenishment", icon: RotateCcw, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.emergencyRequests", href: "/dashboard/procurement/requests/emergency", icon: AlertOctagon, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.packages",
      items: [{ labelKey: "nav.procurementPackages", href: "/dashboard/procurement/packages", icon: Boxes, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" }],
    },
    {
      titleKey: "nav.sourcing",
      items: [
        { labelKey: "nav.rfqs", href: "/dashboard/procurement/sourcing", icon: FilePenLine, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.quotations", href: "/dashboard/procurement/sourcing/quotations", icon: Receipt, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.supplierComparison", href: "/dashboard/procurement/sourcing/comparisons", icon: Scale, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.negotiations", href: "/dashboard/procurement/sourcing/negotiations", icon: Handshake, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.awardRecommendations", href: "/dashboard/procurement/sourcing/awards", icon: Award, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.ordering",
      items: [
        { labelKey: "nav.purchaseOrders", href: "/dashboard/procurement/orders", icon: PackageOpen, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.frameworkOrders", href: "/dashboard/procurement/orders/framework", icon: Repeat, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.delivery",
      items: [
        { labelKey: "nav.deliverySchedule", href: "/dashboard/procurement/deliveries", icon: CalendarClock, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.expectedReceipts", href: "/dashboard/procurement/deliveries/expected", icon: PackageCheck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.serviceReceipts", href: "/dashboard/procurement/deliveries/service", icon: ClipboardCheck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.returnsAndClaims", href: "/dashboard/procurement/deliveries/returns", icon: Undo2, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.suppliers",
      items: [
        { labelKey: "nav.supplierDirectory", href: "/dashboard/procurement/suppliers", icon: Truck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.qualification", href: "/dashboard/procurement/suppliers/qualification", icon: ShieldCheck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.performanceAndRisk", href: "/dashboard/procurement/suppliers/performance", icon: AlertTriangle, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.work",
      items: [
        { labelKey: "nav.approvals", href: "/dashboard/procurement/approvals", icon: ClipboardCheck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.calendar", href: "/calendar", icon: CalendarDays },
        { labelKey: "nav.supplierDocuments", href: "/dashboard/procurement/documents", icon: FileText, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.reporting",
      items: [
        { labelKey: "nav.reports", href: "/dashboard/procurement/reports", icon: BarChart3, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.analytics", href: "/dashboard/procurement/analytics", icon: PieChart, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.settingsSection",
      items: [{ labelKey: "nav.procurementSettings", href: "/dashboard/procurement/settings", icon: SlidersHorizontal, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" }],
    },
  ],
  // PRD_QAQC_Dashboard §3.2 — exact, locked v1 sidebar. Inspection Requests
  // reuses the existing InspectionRequest module (built for Engineer
  // Dashboard); NCRs/Defects/Snag/Punch are new this phase; Quality
  // Planning and the full Handover/Commissioning/DLP subsystem are honest
  // scope-note stubs (no backing model — same treatment BIM's CAD pipeline
  // got), never fabricated data.
  qaqc: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/qaqc", icon: LayoutDashboard, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.myWork", href: "/dashboard/qaqc/my-work", icon: Inbox, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.qualityAlerts", href: "/dashboard/qaqc/alerts", icon: AlertTriangle, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.qualityPlanning",
      items: [
        { labelKey: "nav.qualityPlans", href: "/dashboard/qaqc/plans", icon: NotebookPen, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.itps", href: "/dashboard/qaqc/itps", icon: ClipboardCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.templatesAndChecklists", href: "/dashboard/qaqc/templates", icon: ListChecks, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.inspectionsGroup",
      items: [
        { labelKey: "nav.inspectionRequests", href: "/dashboard/qaqc/inspections", icon: ClipboardList, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.inspectionRecords", href: "/dashboard/qaqc/inspections/records", icon: FileText, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.materialInspections", href: "/dashboard/qaqc/inspections/material", icon: Box, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.workInspections", href: "/dashboard/qaqc/inspections/work", icon: Ruler, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.testsAndSamples", href: "/dashboard/qaqc/tests", icon: FlaskConical, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.qualityReleases", href: "/dashboard/qaqc/releases", icon: PackageCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.qualityIssuesGroup",
      items: [
        { labelKey: "nav.ncrs", href: "/dashboard/qaqc/ncrs", icon: AlertOctagon, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.correctiveActions", href: "/dashboard/qaqc/corrective-actions", icon: Wrench, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.defects", href: "/dashboard/qaqc/defects", icon: Bug, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.snagLists", href: "/dashboard/qaqc/snags", icon: ListChecks, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.punchLists", href: "/dashboard/qaqc/punch", icon: ClipboardPen, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.handover",
      items: [
        { labelKey: "nav.handoverDashboard", href: "/dashboard/qaqc/handover", icon: LayoutDashboard, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.handoverPackages", href: "/dashboard/qaqc/handover/packages", icon: PackageOpen, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.readinessMatrix", href: "/dashboard/qaqc/handover/readiness", icon: BarChart3, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.jointInspections", href: "/dashboard/qaqc/handover/joint-inspections", icon: Users, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.commissioning", href: "/dashboard/qaqc/handover/commissioning", icon: Zap, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.unitsReadyForHandover", href: "/dashboard/qaqc/handover/units", icon: Building2, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.assetsReadyForTransfer", href: "/dashboard/qaqc/handover/assets", icon: Truck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.defectsLiability", href: "/dashboard/qaqc/handover/dlp", icon: ShieldAlert, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.finalCloseout", href: "/dashboard/qaqc/handover/closeout", icon: CheckSquare, resource: "PROJECTS", moduleKey: "PROJECTS" },
      ],
    },
    {
      titleKey: "nav.reporting",
      items: [{ labelKey: "nav.reports", href: "/dashboard/qaqc/reports", icon: BarChart3, resource: "PROJECTS", moduleKey: "PROJECTS" }],
    },
    {
      titleKey: "nav.settingsSection",
      items: [{ labelKey: "nav.qaqcSettings", href: "/dashboard/qaqc/settings", icon: SlidersHorizontal, resource: "PROJECTS", moduleKey: "PROJECTS" }],
    },
  ],
  // PRD_4 CTO-100 — a contractor's entire workspace is their restricted work
  // package view; no resource-gated items apply since CONTRACTOR is NONE on
  // every general resource (see permissions.ts).
  contractor: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/contractor", icon: LayoutDashboard },
      ],
    },
  ],
};

// A dashboard subtree that belongs to a specific department resource — only
// a role with FULL access to that resource (i.e. the role that actually owns
// the department, or Owner/Admin doing legitimate cross-department oversight)
// gets dropped into that subtree's own shell. "executive"/"architect"/
// "contractor" have no entry since they aren't a single department's console.
const SUBTREE_RESOURCE: Partial<Record<keyof typeof NAV_SECTIONS, Resource>> = {
  admin: "USER_MANAGEMENT",
  finance: "FINANCE",
  hr: "HR",
  procurement: "PROCUREMENT",
  legal: "LEGAL",
  hse: "HSE_REPORTS",
  sales: "CLIENTS",
};

// PRD_5 — the dashboard shell is resolved from the authenticated user's own
// role, never from the page they happen to be on. A *shared* module route
// (/clients, /projects, /tasks, /contracts, /documents, ...) is not owned by
// any role — it must render inside the current user's own shell, not
// silently fall back to a hard-coded default and strip away their sidebar.
//
// A path inside another role's dedicated dashboard subtree (e.g. Admin
// browsing /dashboard/finance) shows that subtree's own shell ONLY when the
// visiting role has FULL access to the resource that subtree represents.
// Bug fix: a Sales/PM/Legal/Finance user with mere READ/WRITE visibility
// into another department (e.g. Sales -> FINANCE: READ) must NOT get
// dropped into that department's full console/shell just by clicking a
// cross-department summary link in their own sidebar — they keep their own
// shell while the destination page renders inside it.
// architect/engineering can't use the FULL-on-PROJECTS gate other subtrees
// use — PROJECTS is a coarse shared resource neither ARCHITECT nor ENGINEER
// holds at FULL (only OWNER/ADMIN/CEO/PM do), so that gate would lock out
// the very roles the shell is for. Gate these two by role identity instead
// (plus company-wide oversight roles, same precedent as PRD_10's
// USER_MANAGEMENT:FULL carve-out in canViewTask).
// STOCK likewise doesn't hold PROCUREMENT:FULL (only WRITE — PROCUREMENT the
// role owns that resource at FULL), so Inventory needs the same role-identity
// gate as architect/engineering rather than the FULL-on-resource one.
// QAQC likewise has no dedicated coarse Resource (only PROJECTS:READ, see
// src/app/actions/qaqc.ts's assertProjectsWrite) — same role-identity gate.
const SUBTREE_ROLES: Partial<Record<keyof typeof NAV_SECTIONS, readonly Role[]>> = {
  architect: ["ARCHITECT"],
  engineering: ["ENGINEER"],
  inventory: ["STOCK"],
  qaqc: ["QAQC"],
};

export function workspaceKeyFromPath(pathname: string, role?: Role): keyof typeof NAV_SECTIONS {
  const match = pathname.match(/^\/dashboard\/(executive|admin|finance|hr|architect|engineering|procurement|contractor|legal|hse|sales|inventory|qaqc)/);
  if (match) {
    const key = match[1] as keyof typeof NAV_SECTIONS;
    const allowedRoles = SUBTREE_ROLES[key];
    if (allowedRoles) {
      if (role && (allowedRoles.includes(role) || can(role, "USER_MANAGEMENT", "FULL"))) return key;
    } else {
      const requiredResource = SUBTREE_RESOURCE[key];
      if (!requiredResource || !role || can(role, requiredResource, "FULL")) return key;
    }
  }

  if (role) {
    const homeKey = DASHBOARD_BY_ROLE[role].replace("/dashboard/", "");
    if (homeKey in NAV_SECTIONS) return homeKey as keyof typeof NAV_SECTIONS;
  }

  return "executive";
}

// Filters out nav items (and any section left empty) the given role doesn't
// have at least READ access to — same `can()` gate the destination page
// enforces, so the sidebar never shows a link that would just redirect away.
// Items whose `moduleKey` has been disabled for the tenant (Module Registry)
// are filtered out the same way, regardless of role.
//
// `disabledRoutes` applies the same treatment for Platform Configuration: a
// page node switched off (directly or by an ancestor cascading down) has its
// route stripped here, which is what satisfies the PRDs' "disabled
// functionality must disappear from navigation ... without dead links or
// blank spaces". Sections left with no items disappear entirely rather than
// rendering an empty heading.
export function visibleNavSections(
  sections: NavSection[],
  role: Role,
  disabledModules?: ReadonlySet<ModuleKey>,
  disabledRoutes?: ReadonlySet<string>
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.resource || can(role, item.resource, item.level ?? "READ")) &&
          !(item.moduleKey && disabledModules?.has(item.moduleKey)) &&
          !disabledRoutes?.has(item.href)
      ),
    }))
    .filter((section) => section.items.length > 0);
}
