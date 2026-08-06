import "server-only";
import { db } from "@/lib/db";

// PRD_Platform_UI_UX_Architecture §20/§21 Setup/Project Setup Center. Scoped
// to what it can honestly be here: a status *aggregator* over already-real
// data (counts against existing tables), linking into the existing admin
// pages that actually manage each area — not a rebuilt guided wizard that
// would duplicate/replace those pages' own forms. "Not Started" / "In
// Progress" / "Ready" are derived from real counts, never fabricated.

export type SetupAreaStatus = "NOT_STARTED" | "IN_PROGRESS" | "READY";
export type SetupArea = { key: string; label: string; status: SetupAreaStatus; detail: string; href: string };

function statusFor(count: number, readyAt: number): SetupAreaStatus {
  if (count === 0) return "NOT_STARTED";
  if (count < readyAt) return "IN_PROGRESS";
  return "READY";
}

export async function getSetupStatus(tenantId: string): Promise<SetupArea[]> {
  const [
    company,
    branchCount,
    memberCount,
    invitationCount,
    accountCount,
    fiscalPeriodCount,
    employeeCount,
    payrollGroupCount,
    folderCount,
    projectCount,
    workflowDefCount,
  ] = await Promise.all([
    db.company.findFirst({ where: { tenantId, isParent: true } }),
    db.branch.count({ where: { company: { tenantId } } }),
    db.companyMembership.count({ where: { tenantId, accessMode: { not: "SUSPENDED" } } }),
    db.invitation.count({ where: { tenantId } }),
    db.account.count({ where: { tenantId } }),
    db.fiscalPeriod.count({ where: { tenantId } }),
    db.employee.count({ where: { tenantId } }),
    db.payrollGroup.count({ where: { tenantId } }),
    db.folder.count({ where: { tenantId } }),
    db.project.count({ where: { tenantId } }),
    db.workflowDefinition.count({ where: { tenantId } }),
  ]);

  const areas: SetupArea[] = [
    {
      key: "COMPANY_IDENTITY",
      label: "Company Identity",
      status: company?.legalName && company.countryCode ? "READY" : company ? "IN_PROGRESS" : "NOT_STARTED",
      detail: company ? `${company.name} · ${company.countryCode ?? "no country set"}` : "No company record yet.",
      href: "/company",
    },
    {
      key: "BRANCHES",
      label: "Branches & Offices",
      status: statusFor(branchCount, 1),
      detail: `${branchCount} branch${branchCount === 1 ? "" : "es"} registered.`,
      href: "/company",
    },
    {
      key: "USERS_ROLES",
      label: "Users & Roles",
      status: statusFor(memberCount, 3),
      detail: `${memberCount} active member${memberCount === 1 ? "" : "s"}, ${invitationCount} invitation${invitationCount === 1 ? "" : "s"} sent.`,
      href: "/dashboard/admin/users",
    },
    {
      key: "FINANCE_FOUNDATIONS",
      label: "Finance Foundations",
      status: accountCount === 0 ? "NOT_STARTED" : fiscalPeriodCount === 0 ? "IN_PROGRESS" : "READY",
      detail: `${accountCount} chart-of-accounts entr${accountCount === 1 ? "y" : "ies"}, ${fiscalPeriodCount} fiscal period${fiscalPeriodCount === 1 ? "" : "s"}.`,
      href: "/dashboard/finance/accounts",
    },
    {
      key: "HR_FOUNDATIONS",
      label: "HR Foundations",
      status: employeeCount === 0 ? "NOT_STARTED" : payrollGroupCount === 0 ? "IN_PROGRESS" : "READY",
      detail: `${employeeCount} employee${employeeCount === 1 ? "" : "s"}, ${payrollGroupCount} payroll group${payrollGroupCount === 1 ? "" : "s"}.`,
      href: "/dashboard/hr/employees",
    },
    {
      key: "DOCUMENTS",
      label: "Documents",
      status: statusFor(folderCount, 1),
      detail: `${folderCount} folder${folderCount === 1 ? "" : "s"} in the tree.`,
      href: "/documents",
    },
    {
      key: "PROJECTS",
      label: "Projects",
      status: statusFor(projectCount, 1),
      detail: `${projectCount} project${projectCount === 1 ? "" : "s"} created.`,
      href: "/projects",
    },
    {
      key: "WORKFLOWS",
      label: "Workflows",
      status: statusFor(workflowDefCount, 1),
      detail: `${workflowDefCount} workflow definition${workflowDefCount === 1 ? "" : "s"} published.`,
      href: "/dashboard/admin/workflows",
    },
  ];

  return areas;
}
