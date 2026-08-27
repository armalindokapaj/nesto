import "server-only";
import { db } from "@/lib/db";
import { requireTenantProject } from "@/lib/tenant";

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

  const invoiced = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
  const paid = invoices.filter((i) => i.type === "INVOICE" && i.status === "PAID").reduce((s, i) => s + i.amountMinor, 0);
  const expenses = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const committed = purchaseOrders
    .filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT")
    .reduce((s, po) => s + po.amount, 0);
  const budget = project?.budget ?? 0;
  const remaining = budget - committed - expenses;

  return {
    budget: project?.budget ?? null,
    contractValue: project?.contractValue ?? null,
    invoiced,
    paid,
    outstanding: invoiced - paid,
    committed,
    expenses,
    remaining,
  };
}
