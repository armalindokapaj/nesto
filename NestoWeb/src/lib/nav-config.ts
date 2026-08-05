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
  Truck,
  PackageOpen,
  Workflow,
  Contact,
  SlidersHorizontal,
  Landmark,
  CalendarRange,
  NotebookPen,
  Package,
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
      ],
    },
  ],
  finance: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/finance", icon: LayoutDashboard, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.employees", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.transactions",
      items: [
        { labelKey: "nav.invoices", href: "/dashboard/finance/invoices", icon: FileText, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.bills", href: "/dashboard/finance/bills", icon: Receipt, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.payments", href: "/dashboard/finance/payments", icon: ArrowRightLeft, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.accountingCore",
      items: [
        { labelKey: "nav.chartOfAccounts", href: "/dashboard/finance/accounts", icon: Landmark, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.fiscalPeriods", href: "/dashboard/finance/periods", icon: CalendarRange, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.journalEntries", href: "/dashboard/finance/journal", icon: NotebookPen, resource: "FINANCE", moduleKey: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.financialOperations",
      items: [
        { labelKey: "nav.budgetVsActual", href: "/dashboard/finance/budget", icon: PieChart, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.cashFlow", href: "/dashboard/finance/cash-flow", icon: TrendingUp, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.assets", href: "/dashboard/assets", icon: Boxes, resource: "PROJECTS", moduleKey: "ASSETS" },
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK", moduleKey: "COMPANY_NETWORK" },
        { labelKey: "nav.procurement", href: "/dashboard/procurement", icon: Truck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.inventory", href: "/dashboard/inventory/products", icon: Package, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.compliance",
      items: [
        { labelKey: "nav.taxManagement", href: "/dashboard/finance/tax", icon: Percent, resource: "FINANCE", moduleKey: "FINANCE" },
        { labelKey: "nav.legal", href: "/dashboard/legal", icon: FileText, resource: "LEGAL", moduleKey: "LEGAL" },
        { labelKey: "nav.auditLogs", href: "/dashboard/admin/audit", icon: ScrollText, resource: "AUDIT_LOGS" },
      ],
    },
  ],
  hr: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/hr", icon: LayoutDashboard, resource: "HR", moduleKey: "HR" },
      ],
    },
    {
      titleKey: "nav.workforce",
      items: [
        { labelKey: "nav.calendar", href: "/dashboard/hr/calendar", icon: CalendarDays, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.employees", href: "/dashboard/hr/employees", icon: Users, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.recruitment", href: "/dashboard/hr/recruitment", icon: UserPlus, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.attendance", href: "/dashboard/hr/attendance", icon: ClipboardList, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.leaveRequests", href: "/dashboard/hr/leave", icon: CalendarClock, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.training", href: "/dashboard/hr/training", icon: GraduationCap, resource: "HR", moduleKey: "TRAINING" },
        { labelKey: "nav.payroll", href: "/dashboard/hr/payroll", icon: Wallet, resource: "HR", moduleKey: "HR" },
        { labelKey: "nav.myPayslips", href: "/dashboard/hr/payroll/my-payslips", icon: Wallet },
      ],
    },
    { titleKey: "nav.reports", items: [{ labelKey: "nav.reports", href: "/dashboard/hr/reports", icon: BarChart3, resource: "HR", moduleKey: "HR" }] },
  ],
  architect: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/architect", icon: LayoutDashboard, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.designManagement",
      items: [
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.drawings", href: "/dashboard/architect/drawings", icon: Ruler, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.revisions", href: "/dashboard/architect/revisions", icon: FilePenLine, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.rfis", href: "/dashboard/architect/rfis", icon: HelpCircle, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.approvals", href: "/dashboard/architect/approvals", icon: ClipboardCheck, resource: "PROJECTS", moduleKey: "PROJECTS" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS", moduleKey: "TASKS" },
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS", moduleKey: "CLIENTS" },
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.hse", href: "/dashboard/hse", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
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
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS", moduleKey: "HSE_REPORTS" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
  ],
  procurement: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/procurement", icon: LayoutDashboard, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.purchasing",
      items: [
        { labelKey: "nav.procurementWorkspace", href: "/dashboard/procurement/workspace", icon: Workflow, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.purchaseRequests", href: "/dashboard/procurement/requests", icon: ClipboardList, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.procurementPackages", href: "/dashboard/procurement/packages", icon: Boxes, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.sourcing", href: "/dashboard/procurement/sourcing", icon: FilePenLine, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.suppliers", href: "/dashboard/procurement/suppliers", icon: Truck, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.purchaseOrders", href: "/dashboard/procurement/orders", icon: PackageOpen, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.deliveries", href: "/dashboard/procurement/deliveries", icon: CalendarClock, resource: "PROCUREMENT", moduleKey: "PROCUREMENT" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK", moduleKey: "COMPANY_NETWORK" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
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
export function workspaceKeyFromPath(pathname: string, role?: Role): keyof typeof NAV_SECTIONS {
  const match = pathname.match(/^\/dashboard\/(executive|admin|finance|hr|architect|procurement|contractor|legal|hse)/);
  if (match) {
    const key = match[1] as keyof typeof NAV_SECTIONS;
    const requiredResource = SUBTREE_RESOURCE[key];
    if (!requiredResource || !role || can(role, requiredResource, "FULL")) return key;
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
