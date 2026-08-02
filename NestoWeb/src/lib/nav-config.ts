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
  Settings,
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
} from "lucide-react";
import { can, type Resource, type Level } from "@/lib/permissions";
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
      items: [{ labelKey: "nav.dashboard", href: "/dashboard/executive", icon: LayoutDashboard }],
    },
    {
      titleKey: "nav.operations",
      items: [
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
        { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare, resource: "TASKS" },
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
    { items: [{ labelKey: "nav.dashboard", href: "/dashboard/admin", icon: LayoutDashboard, resource: "USER_MANAGEMENT" }] },
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
    { items: [{ labelKey: "nav.dashboard", href: "/dashboard/finance", icon: LayoutDashboard, resource: "FINANCE" }] },
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
    { titleKey: "nav.settings", items: [{ labelKey: "nav.settings", href: "/dashboard/finance/settings", icon: Settings, resource: "FINANCE" }] },
  ],
  hr: [
    { items: [{ labelKey: "nav.overview", href: "/dashboard/hr", icon: LayoutDashboard, resource: "HR" }] },
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
    { titleKey: "nav.settings", items: [{ labelKey: "nav.settings", href: "/dashboard/hr/settings", icon: Settings, resource: "HR" }] },
  ],
  architect: [
    { items: [{ labelKey: "nav.overview", href: "/dashboard/architect", icon: LayoutDashboard, resource: "PROJECTS" }] },
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
    { titleKey: "nav.projectSettings", items: [{ labelKey: "nav.settings", href: "/dashboard/architect/settings", icon: Settings, resource: "PROJECTS" }] },
  ],
  procurement: [
    { items: [{ labelKey: "nav.overview", href: "/dashboard/procurement", icon: LayoutDashboard, resource: "PROCUREMENT" }] },
    {
      titleKey: "nav.purchasing",
      items: [
        { labelKey: "nav.suppliers", href: "/dashboard/procurement/suppliers", icon: Truck, resource: "PROCUREMENT" },
        { labelKey: "nav.purchaseOrders", href: "/dashboard/procurement/orders", icon: PackageOpen, resource: "PROCUREMENT" },
        { labelKey: "nav.projects", href: "/projects", icon: FolderKanban },
      ],
    },
    { titleKey: "nav.settings", items: [{ labelKey: "nav.settings", href: "/dashboard/procurement/settings", icon: Settings, resource: "PROCUREMENT" }] },
  ],
};

export function workspaceKeyFromPath(pathname: string): keyof typeof NAV_SECTIONS {
  const match = pathname.match(/^\/dashboard\/(executive|admin|finance|hr|architect|procurement)/);
  return (match?.[1] as keyof typeof NAV_SECTIONS) ?? "executive";
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
