import "server-only";
import { db } from "@/lib/db";
import { requireTenantProject } from "@/lib/tenant";
import { toMinorUnits } from "@/lib/money";

// PRD_Rework_1 §13 — a summary-level embedded view, mirroring
// getFinanceDashboardData in src/server/finance.ts but scoped to one
// project. Values stay owned by the central Finance module; this just
// answers "how is this project doing" without re-implementing every finance
// page inside the project hub.
export async function getProjectFinanceDashboardData(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  const [project, invoices, purchaseOrders] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { budget: true, contractValue: true } }),
    db.invoice.findMany({ where: { tenantId, projectId } }),
    db.purchaseOrder.findMany({ where: { tenantId, projectId } }),
  ]);

  // Every money figure below is integer minor units, named accordingly.
  // Project.budget/contractValue are still decimal Floats (Priority 3 of the
  // money migration) and are converted on read: `remaining` used to subtract
  // minor-unit spend from a major-unit budget, which is wrong by 100x.
  const invoicedMinor = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
  const paidMinor = invoices.filter((i) => i.type === "INVOICE" && i.status === "PAID").reduce((s, i) => s + i.amountMinor, 0);
  const expensesMinor = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const committedMinor = purchaseOrders
    .filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT")
    .reduce((s, po) => s + po.amountMinor, 0);
  const budgetMinor = toMinorUnits(project?.budget ?? 0);
  const remainingMinor = budgetMinor - committedMinor - expensesMinor;

  return {
    budgetMinor: project?.budget == null ? null : budgetMinor,
    contractValueMinor: project?.contractValue == null ? null : toMinorUnits(project.contractValue),
    invoicedMinor,
    paidMinor,
    outstandingMinor: invoicedMinor - paidMinor,
    committedMinor,
    expensesMinor,
    remainingMinor,
  };
}
