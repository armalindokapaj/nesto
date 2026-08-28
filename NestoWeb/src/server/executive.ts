import { db } from "@/lib/db";
import { PROJECT_STATUSES } from "@/lib/constants";

// Audit C1 — Finance figures are omitted at the query layer for a caller
// without Finance access, not merely hidden by the page. `revenue`/
// `cashFlowSeries` are `null` rather than computed-then-discarded, so a
// future page change can't accidentally re-expose them by rendering the
// object without re-checking permission.
export async function getExecutiveDashboardData(tenantId: string, canViewFinance: boolean) {
  const [projects, invoices, tasks, childCompanies] = await Promise.all([
    db.project.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    canViewFinance ? db.invoice.findMany({ where: { tenantId } }) : Promise.resolve(null),
    db.task.findMany({ where: { tenantId, status: { in: ["REVIEW", "APPROVED"] } } }),
    db.company.count({ where: { tenantId, isParent: false } }),
  ]);

  const activeProjects = projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "COMPLETED");
  const pendingApprovals = tasks.length;
  const risks = projects.filter((p) => p.status === "AT_RISK" || p.status === "DELAYED").length;

  return {
    activeProjectCount: activeProjects.length,
    revenueMinor: invoices ? invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0) : null,
    pendingApprovals,
    risks,
    subsidiaryCount: childCompanies,
    projects: activeProjects.slice(0, 5),
    cashFlowSeries: invoices ? buildMonthlySeries(invoices) : null,
  };
}

function buildMonthlySeries(invoices: { amountMinor: number; type: string; issuedDate: Date }[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = new Map<string, { budgetMinor: number; actualMinor: number }>();
  for (const m of months) byMonth.set(m, { budgetMinor: 0, actualMinor: 0 });

  for (const inv of invoices) {
    const label = months[inv.issuedDate.getMonth()];
    const entry = byMonth.get(label)!;
    if (inv.type === "INVOICE") entry.actualMinor += inv.amountMinor;
    else entry.budgetMinor += Math.abs(inv.amountMinor);
  }

  const currentMonth = new Date().getMonth();
  return months.slice(0, currentMonth + 1).map((label) => ({ label, ...byMonth.get(label)! }));
}

export const ALL_PROJECT_STATUSES = PROJECT_STATUSES;
