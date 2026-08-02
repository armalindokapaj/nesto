import { db } from "@/lib/db";

export async function getFinanceDashboardData(tenantId: string) {
  const [invoices, accounts, projects] = await Promise.all([
    db.invoice.findMany({
      where: { tenantId },
      orderBy: { issuedDate: "desc" },
      include: { project: true },
    }),
    db.financeAccount.findMany({ where: { tenantId } }),
    db.project.findMany({ where: { tenantId }, include: { invoices: true } }),
  ]);

  const revenue = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amount, 0);
  const expenses = invoices
    .filter((i) => i.type === "EXPENSE" || i.type === "BILL")
    .reduce((s, i) => s + Math.abs(i.amount), 0);
  const netProfit = revenue - expenses;
  const cashBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const outstanding = invoices.filter((i) => i.type === "INVOICE" && i.status !== "PAID");
  const outstandingAmount = outstanding.reduce((s, i) => s + i.amount, 0);

  const revenueByProject = projects
    .map((p) => ({
      label: p.name,
      value: p.invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amount, 0),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const upcomingPayments = invoices
    .filter((i) => (i.type === "BILL" || i.type === "EXPENSE") && i.status !== "COMPLETED" && i.dueDate)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
    .slice(0, 4);

  return {
    revenue,
    expenses,
    netProfit,
    cashBalance,
    outstandingAmount,
    outstandingCount: outstanding.length,
    accounts,
    recentTransactions: invoices.slice(0, 5),
    revenueByProject,
    upcomingPayments,
    cashFlowSeries: buildMonthlyCashFlow(invoices),
  };
}

export async function listInvoicesByType(tenantId: string, type: "INVOICE" | "BILL" | "PAYMENT") {
  return db.invoice.findMany({
    where: { tenantId, type },
    orderBy: { issuedDate: "desc" },
    include: { project: true },
  });
}

export async function listTaxRelated(tenantId: string) {
  return db.invoice.findMany({
    where: { tenantId, OR: [{ description: { contains: "Tax" } }, { number: { contains: "TAX" } }] },
    orderBy: { issuedDate: "desc" },
  });
}

export async function getBudgetVsActualByProject(tenantId: string) {
  const projects = await db.project.findMany({
    where: { tenantId },
    include: { invoices: true },
  });

  return projects.map((p) => {
    const actualRevenue = p.invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amount, 0);
    const actualExpenses = p.invoices
      .filter((i) => i.type === "EXPENSE" || i.type === "BILL")
      .reduce((s, i) => s + Math.abs(i.amount), 0);
    return {
      id: p.id,
      name: p.name,
      budget: p.budget ?? 0,
      actualRevenue,
      actualExpenses,
    };
  });
}

export async function listAssets(tenantId: string) {
  return db.asset.findMany({
    where: { tenantId },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
}

function buildMonthlyCashFlow(invoices: { amount: number; type: string; issuedDate: Date }[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = new Map<string, { revenue: number; expenses: number }>();
  for (const m of months) byMonth.set(m, { revenue: 0, expenses: 0 });

  for (const inv of invoices) {
    const label = months[inv.issuedDate.getMonth()];
    const entry = byMonth.get(label)!;
    if (inv.type === "INVOICE") entry.revenue += inv.amount;
    else entry.expenses += Math.abs(inv.amount);
  }

  const currentMonth = new Date().getMonth();
  return months.slice(0, currentMonth + 1).map((label) => ({ label, ...byMonth.get(label)! }));
}
