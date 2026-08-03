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
} from "lucide-react";
import { can, DASHBOARD_BY_ROLE, type Resource, type Level } from "@/lib/permissions";
import type { Role } from "@/lib/constants";

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
export type NavItem = { labelKey: string; href: string; icon: LucideIcon; resource?: Resource; level?: Level };
export type NavSection = { titleKey?: string; items: NavItem[] };

// Fixed, role-specific sidebar sections — DAS-001 (no widget/nav rearranging
// in V1) and matches the approved visual references' per-dashboard sidebars.
export const NAV_SECTIONS: Record<string, NavSection[]> = {
  executive: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/executive", icon: LayoutDashboard },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.operations",
      items: [
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS" },
        { labelKey: "nav.taskOrchestration", href: "/tasks/orchestration", icon: Workflow, resource: "TASKS" },
        { labelKey: "nav.contracts", href: "/contracts", icon: FileText, resource: "CONTRACTS" },
        { labelKey: "nav.documents", href: "/documents", icon: BookText, resource: "PROJECTS" },
        { labelKey: "nav.meetings", href: "/meetings", icon: CalendarDays, resource: "PROJECTS" },
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS" },
      ],
    },
    {
      titleKey: "nav.business",
      items: [
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS" },
        { labelKey: "nav.finance", href: "/dashboard/finance", icon: Wallet, resource: "FINANCE" },
        { labelKey: "nav.hr", href: "/dashboard/hr", icon: Users, resource: "HR" },
        { labelKey: "nav.procurement", href: "/dashboard/procurement", icon: Truck, resource: "PROCUREMENT" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK" },
        { labelKey: "nav.reports", href: "/reports", icon: BarChart3, resource: "PROJECTS" },
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
        { labelKey: "nav.integrations", href: "/dashboard/admin/integrations", icon: Plug, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.security", href: "/dashboard/admin/security", icon: Lock, resource: "USER_MANAGEMENT" },
        { labelKey: "nav.auditLogs", href: "/dashboard/admin/audit", icon: ScrollText, resource: "AUDIT_LOGS" },
      ],
    },
  ],
  finance: [
    {
      items: [
        { labelKey: "nav.dashboard", href: "/dashboard/finance", icon: LayoutDashboard, resource: "FINANCE" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.transactions",
      items: [
        { labelKey: "nav.invoices", href: "/dashboard/finance/invoices", icon: FileText, resource: "FINANCE" },
        { labelKey: "nav.bills", href: "/dashboard/finance/bills", icon: Receipt, resource: "FINANCE" },
        { labelKey: "nav.payments", href: "/dashboard/finance/payments", icon: ArrowRightLeft, resource: "FINANCE" },
      ],
    },
    {
      titleKey: "nav.financialOperations",
      items: [
        { labelKey: "nav.budgetVsActual", href: "/dashboard/finance/budget", icon: PieChart, resource: "FINANCE" },
        { labelKey: "nav.cashFlow", href: "/dashboard/finance/cash-flow", icon: TrendingUp, resource: "FINANCE" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.assets", href: "/dashboard/finance/assets", icon: Boxes, resource: "FINANCE" },
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS" },
        { labelKey: "nav.contractors", href: "/contractors", icon: UserCog, resource: "COMPANY_NETWORK" },
        { labelKey: "nav.procurement", href: "/dashboard/procurement", icon: Truck, resource: "PROCUREMENT" },
      ],
    },
    {
      titleKey: "nav.compliance",
      items: [
        { labelKey: "nav.taxManagement", href: "/dashboard/finance/tax", icon: Percent, resource: "FINANCE" },
        { labelKey: "nav.auditLogs", href: "/dashboard/admin/audit", icon: ScrollText, resource: "AUDIT_LOGS" },
      ],
    },
  ],
  hr: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/hr", icon: LayoutDashboard, resource: "HR" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.workforce",
      items: [
        { labelKey: "nav.calendar", href: "/dashboard/hr/calendar", icon: CalendarDays, resource: "HR" },
        { labelKey: "nav.employees", href: "/dashboard/hr/employees", icon: Users, resource: "HR" },
        { labelKey: "nav.recruitment", href: "/dashboard/hr/recruitment", icon: UserPlus, resource: "HR" },
        { labelKey: "nav.attendance", href: "/dashboard/hr/attendance", icon: ClipboardList, resource: "HR" },
        { labelKey: "nav.leaveRequests", href: "/dashboard/hr/leave", icon: CalendarClock, resource: "HR" },
        { labelKey: "nav.training", href: "/dashboard/hr/training", icon: GraduationCap, resource: "HR" },
      ],
    },
    { titleKey: "nav.reports", items: [{ labelKey: "nav.reports", href: "/dashboard/hr/reports", icon: BarChart3, resource: "HR" }] },
  ],
  architect: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/architect", icon: LayoutDashboard, resource: "PROJECTS" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.designManagement",
      items: [
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.drawings", href: "/dashboard/architect/drawings", icon: Ruler, resource: "PROJECTS" },
        { labelKey: "nav.revisions", href: "/dashboard/architect/revisions", icon: FilePenLine, resource: "PROJECTS" },
        { labelKey: "nav.rfis", href: "/dashboard/architect/rfis", icon: HelpCircle, resource: "PROJECTS" },
        { labelKey: "nav.approvals", href: "/dashboard/architect/approvals", icon: ClipboardCheck, resource: "PROJECTS" },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS" },
        { labelKey: "nav.clients", href: "/clients", icon: Handshake, resource: "CLIENTS" },
        { labelKey: "nav.hseReports", href: "/hse-reports", icon: ShieldAlert, resource: "HSE_REPORTS" },
      ],
    },
  ],
  procurement: [
    {
      items: [
        { labelKey: "nav.overview", href: "/dashboard/procurement", icon: LayoutDashboard, resource: "PROCUREMENT" },
        { labelKey: "nav.employeeDirectory", href: "/employees", icon: Contact },
      ],
    },
    {
      titleKey: "nav.purchasing",
      items: [
        { labelKey: "nav.suppliers", href: "/dashboard/procurement/suppliers", icon: Truck, resource: "PROCUREMENT" },
        { labelKey: "nav.purchaseOrders", href: "/dashboard/procurement/orders", icon: PackageOpen, resource: "PROCUREMENT" },
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
  const match = pathname.match(/^\/dashboard\/(executive|admin|finance|hr|architect|procurement|contractor)/);
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
export function visibleNavSections(sections: NavSection[], role: Role): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.resource || can(role, item.resource, item.level ?? "READ")),
    }))
    .filter((section) => section.items.length > 0);
}
