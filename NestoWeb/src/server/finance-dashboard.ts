import "server-only";
import { db } from "@/lib/db";
import { getProjectFinanceDashboardData } from "@/server/project-finance";

// Finance read models. Every export here is read-only aggregation over data
// that finance.ts owns the writes for — the split exists so that adding or
// reshaping a KPI can never touch posting, approval or budget-revision logic.

const OVERDUE_STATUSES = ["PENDING", "SENT", "OVERDUE", "SUBMITTED"];

async function projectPortfolioRow(tenantId: string, project: { id: string; name: string; budget: number | null; companyId: string }) {
  const [budgetRow, purchaseOrders, invoices, spendingBills] = await Promise.all([
    db.budget.findFirst({ where: { tenantId, projectId: project.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    db.purchaseOrder.findMany({ where: { tenantId, projectId: project.id } }),
    db.invoice.findMany({ where: { tenantId, projectId: project.id } }),
    db.spendingBill.findMany({ where: { tenantId, projectId: project.id } }),
  ]);

  const budgetAmount = budgetRow?.baselineAmount ?? project.budget ?? 0;
  const revenue = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amount, 0);
  const receivables = invoices.filter((i) => i.type === "INVOICE" && i.status !== "PAID" && i.status !== "COMPLETED").reduce((s, i) => s + i.amount, 0);
  const invoiceExpenses = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amount), 0);
  const payablesFromInvoices = invoices
    .filter((i) => (i.type === "EXPENSE" || i.type === "BILL") && i.status !== "PAID" && i.status !== "COMPLETED")
    .reduce((s, i) => s + Math.abs(i.amount), 0);
  const paidSpendingAmount = spendingBills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0);
  const approvedNotPaidAmount = spendingBills.filter((b) => b.status === "APPROVED_FOR_PAYMENT").reduce((s, b) => s + b.amount, 0);
  // Spendings (§6.2): Finance-approved OR Paid only — draft/rejected/pending excluded.
  const spendingsAmount = paidSpendingAmount + approvedNotPaidAmount;
  const poCommitted = purchaseOrders.filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT").reduce((s, po) => s + po.amount, 0);
  const pendingSpendingCommitted = spendingBills
    .filter((b) => b.status === "PENDING_SUPERIOR" || b.status === "PENDING_FINANCE")
    .reduce((s, b) => s + b.amount, 0);
  const committed = poCommitted + pendingSpendingCommitted + approvedNotPaidAmount;
  // Actual (§9.2 "Posted Finance transactions"): posted expense invoices + paid Spending Bills.
  const actual = invoiceExpenses + paidSpendingAmount;
  const profit = revenue - actual;
  const payables = payablesFromInvoices + approvedNotPaidAmount;
  // Forecast (Estimate at Completion, EVM-style approximation): spent-to-date + still-committed.
  const forecast = actual + committed;
  // Cost to Complete: the gap between the completion forecast and what's spent so far.
  const costToComplete = Math.max(forecast - actual, 0);

  return {
    project: { id: project.id, name: project.name },
    budget: budgetAmount,
    committed,
    actual,
    spendings: spendingsAmount,
    revenue,
    profit,
    receivables,
    payables,
    forecast,
    costToComplete,
  };
}

export async function getProjectFinancialPortfolio(tenantId: string) {
  const projects = await db.project.findMany({
    where: { tenantId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, budget: true, companyId: true },
    orderBy: { name: "asc" },
  });
  return Promise.all(projects.map((p) => projectPortfolioRow(tenantId, p)));
}

export async function getCompanyFinanceOverview(tenantId: string) {
  const [invoices, accounts, portfolio, spendingSummary, taxInvoices] = await Promise.all([
    db.invoice.findMany({ where: { tenantId } }),
    db.financeAccount.findMany({ where: { tenantId } }),
    getProjectFinancialPortfolio(tenantId),
    getSpendingsSummary(tenantId),
    db.invoice.findMany({ where: { tenantId, OR: [{ description: { contains: "Tax" } }, { number: { contains: "TAX" } }] } }),
  ]);

  const revenue = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amount, 0);
  const expenses = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amount), 0);
  // Gross/Net/EBITDA v1 approximation — no COGS/overhead/D&A split exists yet
  // in this data model, so all three collapse to the same reproducible
  // revenue-minus-expenses formula, documented rather than fabricated apart.
  const grossProfit = revenue - expenses;
  const netProfit = grossProfit;
  const ebitda = netProfit;
  const cashPosition = accounts.reduce((s, a) => s + a.balance, 0);
  const receivables = invoices.filter((i) => i.type === "INVOICE" && OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const payables = invoices.filter((i) => (i.type === "EXPENSE" || i.type === "BILL") && OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + Math.abs(i.amount), 0);
  const now = new Date();
  const overdue = invoices.filter((i) => i.dueDate && i.dueDate < now && OVERDUE_STATUSES.includes(i.status));
  const overdueAmount = overdue.reduce((s, i) => s + Math.abs(i.amount), 0);
  const upcoming = invoices
    .filter((i) => (i.type === "BILL" || i.type === "EXPENSE") && i.status !== "COMPLETED" && i.dueDate && i.dueDate >= now)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  const companyBudget = await db.budget.findFirst({ where: { tenantId, projectId: null, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  const portfolioCommitted = portfolio.reduce((s, p) => s + p.committed + p.actual, 0);
  const budgetUsagePct = companyBudget && companyBudget.baselineAmount > 0 ? Math.round((portfolioCommitted / companyBudget.baselineAmount) * 1000) / 10 : null;

  const totalForecast = portfolio.reduce((s, p) => s + p.forecast, 0);
  const totalBudget = portfolio.reduce((s, p) => s + p.budget, 0);
  const forecastVariance = totalForecast - totalBudget;

  const taxLiabilities = taxInvoices.filter((i) => OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + Math.abs(i.amount), 0);

  const recentActivity = await db.financeActivity.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { actor: { select: { id: true, displayName: true } } },
  });

  return {
    kpis: {
      cashPosition,
      revenue,
      expenses,
      grossProfit,
      netProfit,
      ebitda,
      receivables,
      payables,
      overdueInvoices: { count: overdue.length, amount: overdueAmount },
      upcomingPayments: upcoming,
      budgetUsagePct,
      forecastVariance,
      taxLiabilities,
    },
    spendingControl: spendingSummary,
    projectPortfolio: portfolio,
    recentActivity,
  };
}

export async function getAllProjectsFinanceOverview(tenantId: string) {
  const portfolio = await getProjectFinancialPortfolio(tenantId);
  const totals = portfolio.reduce(
    (acc, p) => ({
      budget: acc.budget + p.budget,
      committed: acc.committed + p.committed,
      actual: acc.actual + p.actual,
      revenue: acc.revenue + p.revenue,
      profit: acc.profit + p.profit,
      receivables: acc.receivables + p.receivables,
      payables: acc.payables + p.payables,
      forecast: acc.forecast + p.forecast,
      costToComplete: acc.costToComplete + p.costToComplete,
    }),
    { budget: 0, committed: 0, actual: 0, revenue: 0, profit: 0, receivables: 0, payables: 0, forecast: 0, costToComplete: 0 }
  );
  return { totals, portfolio };
}

/** Read-only project identity for the Project Finance tab header — never edits Projects (§9.1). */
export async function getProjectHeaderInfo(tenantId: string, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, status: true } });
  if (!project) throw new Error("Project not found.");
  return project;
}

export async function getSingleProjectFinanceOverview(tenantId: string, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, status: true, budget: true, companyId: true } });
  if (!project) throw new Error("Project not found.");

  const [embedded, row, spendingBills, cashFlowInvoices] = await Promise.all([
    getProjectFinanceDashboardData(tenantId, projectId),
    projectPortfolioRow(tenantId, project),
    db.spendingBill.findMany({ where: { tenantId, projectId }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ where: { tenantId, projectId } }),
  ]);
  const cashIn = cashFlowInvoices.filter((i) => i.type === "INVOICE" && (i.status === "PAID" || i.status === "COMPLETED")).reduce((s, i) => s + i.amount, 0);
  const cashOut = cashFlowInvoices
    .filter((i) => (i.type === "EXPENSE" || i.type === "BILL" || i.type === "PAYMENT") && (i.status === "PAID" || i.status === "COMPLETED"))
    .reduce((s, i) => s + Math.abs(i.amount), 0);

  return {
    project,
    portfolioRow: row,
    embedded, // reuses src/server/project-finance.ts (Projects hub's own summary) — not duplicated, just read
    spendingBillsCount: spendingBills.length,
    cashFlow: cashIn - cashOut,
  };
}

// -------------------------------------------------------------------------
// Spendings summary
// -------------------------------------------------------------------------

export async function getSpendingsSummary(tenantId: string, companyId?: string) {
  const where = { tenantId, companyId };
  const [pending, approved, paid, overBudget] = await Promise.all([
    db.spendingBill.aggregate({ where: { ...where, status: { in: ["PENDING_SUPERIOR", "PENDING_FINANCE"] } }, _sum: { amount: true }, _count: true }),
    db.spendingBill.aggregate({ where: { ...where, status: "APPROVED_FOR_PAYMENT" }, _sum: { amount: true }, _count: true }),
    db.spendingBill.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: true }),
    db.spendingBill.count({ where: { ...where, overBudget: true, status: { notIn: ["PAID", "REJECTED", "DRAFT"] } } }),
  ]);
  return {
    pendingApprovalCount: pending._count,
    pendingApprovalAmount: pending._sum.amount ?? 0,
    approvedForPaymentCount: approved._count,
    approvedForPaymentAmount: approved._sum.amount ?? 0,
    paidCount: paid._count,
    paidAmount: paid._sum.amount ?? 0,
    overBudgetCount: overBudget,
  };
}

// -------------------------------------------------------------------------
// Company-wide invoice roll-up (cash flow, tax, budget-vs-actual pages)
// -------------------------------------------------------------------------

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
