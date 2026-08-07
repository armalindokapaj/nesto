import "server-only";
import { db } from "@/lib/db";
import { getProjectFinanceDashboardData } from "@/server/project-finance";
import { getSpendingsSummary } from "@/server/finance-spendings";

// PRD_Finance_Dashboard §5-9 — the three dashboard scope-mode read models
// (Company Overview / All Projects / Single Project). §15 "Every KPI must
// have a defined formula" — formulas are documented inline rather than in a
// separate spec, since this is the only place they're computed.
//
// Company scope note: Invoice/FinanceAccount/SpendingBill company-wide rows
// carry tenantId but not always companyId (Invoice has none at all), and
// this app's active-company selection is still the PRD_16 stub (always
// `tenant.companies[0]`, no real switcher yet — see src/lib/dal.ts). "Company
// Overview" here is therefore tenant-wide, matching that existing precedent
// rather than fabricating per-company filtering the rest of the app doesn't
// have either.

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
