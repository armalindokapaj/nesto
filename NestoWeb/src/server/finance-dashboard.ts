import "server-only";
import { db } from "@/lib/db";
import { getProjectFinanceDashboardData } from "@/server/project-finance";
import { toMinorUnits } from "@/lib/money";

// Money units: everything this file returns is integer minor units, and every
// field carrying money is named `...Minor` so a caller can see the unit at the
// call site. Sources that are still decimal Floats (Budget.baselineAmount,
// Project.budget, FinanceAccount.balance — Priority 3 of the money migration)
// are converted on read, so no expression here ever mixes cents with euros.
// Mixing them is not a rendering nit: budgetUsagePct was dividing a minor-unit
// numerator by a major-unit denominator and reporting 100x the real figure.

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

  // Budget.baselineAmount / Project.budget are still decimal Floats; convert on
  // read so the whole row is one unit and comparisons against it are meaningful.
  const budgetAmountMinor = budgetRow
    ? toMinorUnits(budgetRow.baselineAmount, budgetRow.currency)
    : toMinorUnits(project.budget ?? 0);
  const revenueMinor = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
  const receivablesMinor = invoices.filter((i) => i.type === "INVOICE" && i.status !== "PAID" && i.status !== "COMPLETED").reduce((s, i) => s + i.amountMinor, 0);
  const invoiceExpensesMinor = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const payablesFromInvoicesMinor = invoices
    .filter((i) => (i.type === "EXPENSE" || i.type === "BILL") && i.status !== "PAID" && i.status !== "COMPLETED")
    .reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const paidSpendingMinor = spendingBills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amountMinor, 0);
  const approvedNotPaidMinor = spendingBills.filter((b) => b.status === "APPROVED_FOR_PAYMENT").reduce((s, b) => s + b.amountMinor, 0);
  // Spendings (§6.2): Finance-approved OR Paid only — draft/rejected/pending excluded.
  const spendingsMinor = paidSpendingMinor + approvedNotPaidMinor;
  const poCommittedMinor = purchaseOrders.filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT").reduce((s, po) => s + po.amountMinor, 0);
  const pendingSpendingCommittedMinor = spendingBills
    .filter((b) => b.status === "PENDING_SUPERIOR" || b.status === "PENDING_FINANCE")
    .reduce((s, b) => s + b.amountMinor, 0);
  const committedMinor = poCommittedMinor + pendingSpendingCommittedMinor + approvedNotPaidMinor;
  // Actual (§9.2 "Posted Finance transactions"): posted expense invoices + paid Spending Bills.
  const actualMinor = invoiceExpensesMinor + paidSpendingMinor;
  const profitMinor = revenueMinor - actualMinor;
  const payablesMinor = payablesFromInvoicesMinor + approvedNotPaidMinor;
  // Forecast (Estimate at Completion, EVM-style approximation): spent-to-date + still-committed.
  const forecastMinor = actualMinor + committedMinor;
  // Cost to Complete: the gap between the completion forecast and what's spent so far.
  const costToCompleteMinor = Math.max(forecastMinor - actualMinor, 0);

  return {
    project: { id: project.id, name: project.name },
    budgetMinor: budgetAmountMinor,
    committedMinor,
    actualMinor,
    spendingsMinor,
    revenueMinor,
    profitMinor,
    receivablesMinor,
    payablesMinor,
    forecastMinor,
    costToCompleteMinor,
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
    db.invoice.findMany({ where: { tenantId, OR: [{ description: { contains: "Tax", mode: "insensitive" as const } }, { number: { contains: "TAX", mode: "insensitive" as const } }] } }),
  ]);

  const revenueMinor = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
  const expensesMinor = invoices.filter((i) => i.type === "EXPENSE" || i.type === "BILL").reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  // Gross/Net/EBITDA v1 approximation — no COGS/overhead/D&A split exists yet
  // in this data model, so all three collapse to the same reproducible
  // revenue-minus-expenses formula, documented rather than fabricated apart.
  const grossProfitMinor = revenueMinor - expensesMinor;
  const netProfitMinor = grossProfitMinor;
  const ebitdaMinor = netProfitMinor;
  const cashPositionMinor = accounts.reduce((s, a) => s + toMinorUnits(a.balance, a.currency), 0);
  const receivablesMinor = invoices.filter((i) => i.type === "INVOICE" && OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + i.amountMinor, 0);
  const payablesMinor = invoices.filter((i) => (i.type === "EXPENSE" || i.type === "BILL") && OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const now = new Date();
  const overdue = invoices.filter((i) => i.dueDate && i.dueDate < now && OVERDUE_STATUSES.includes(i.status));
  const overdueAmountMinor = overdue.reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const upcoming = invoices
    .filter((i) => (i.type === "BILL" || i.type === "EXPENSE") && i.status !== "COMPLETED" && i.dueDate && i.dueDate >= now)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  const companyBudget = await db.budget.findFirst({ where: { tenantId, projectId: null, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  const portfolioCommittedMinor = portfolio.reduce((s, p) => s + p.committedMinor + p.actualMinor, 0);
  // Both sides in minor units. Dividing minor by major here reported budget
  // usage as 100x its real value — 40% of budget read as 4,000%.
  const companyBudgetMinor = companyBudget ? toMinorUnits(companyBudget.baselineAmount, companyBudget.currency) : 0;
  const budgetUsagePct = companyBudgetMinor > 0 ? Math.round((portfolioCommittedMinor / companyBudgetMinor) * 1000) / 10 : null;

  const totalForecastMinor = portfolio.reduce((s, p) => s + p.forecastMinor, 0);
  const totalBudgetMinor = portfolio.reduce((s, p) => s + p.budgetMinor, 0);
  const forecastVarianceMinor = totalForecastMinor - totalBudgetMinor;

  const taxLiabilitiesMinor = taxInvoices.filter((i) => OVERDUE_STATUSES.includes(i.status)).reduce((s, i) => s + Math.abs(i.amountMinor), 0);

  const recentActivity = await db.financeActivity.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { actor: { select: { id: true, displayName: true } } },
  });

  return {
    kpis: {
      cashPositionMinor,
      revenueMinor,
      expensesMinor,
      grossProfitMinor,
      netProfitMinor,
      ebitdaMinor,
      receivablesMinor,
      payablesMinor,
      overdueInvoices: { count: overdue.length, amountMinor: overdueAmountMinor },
      upcomingPayments: upcoming,
      budgetUsagePct,
      forecastVarianceMinor,
      taxLiabilitiesMinor,
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
      budgetMinor: acc.budgetMinor + p.budgetMinor,
      committedMinor: acc.committedMinor + p.committedMinor,
      actualMinor: acc.actualMinor + p.actualMinor,
      revenueMinor: acc.revenueMinor + p.revenueMinor,
      profitMinor: acc.profitMinor + p.profitMinor,
      receivablesMinor: acc.receivablesMinor + p.receivablesMinor,
      payablesMinor: acc.payablesMinor + p.payablesMinor,
      forecastMinor: acc.forecastMinor + p.forecastMinor,
      costToCompleteMinor: acc.costToCompleteMinor + p.costToCompleteMinor,
    }),
    { budgetMinor: 0, committedMinor: 0, actualMinor: 0, revenueMinor: 0, profitMinor: 0, receivablesMinor: 0, payablesMinor: 0, forecastMinor: 0, costToCompleteMinor: 0 }
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
  const cashInMinor = cashFlowInvoices.filter((i) => i.type === "INVOICE" && (i.status === "PAID" || i.status === "COMPLETED")).reduce((s, i) => s + i.amountMinor, 0);
  const cashOutMinor = cashFlowInvoices
    .filter((i) => (i.type === "EXPENSE" || i.type === "BILL" || i.type === "PAYMENT") && (i.status === "PAID" || i.status === "COMPLETED"))
    .reduce((s, i) => s + Math.abs(i.amountMinor), 0);

  return {
    project,
    portfolioRow: row,
    embedded, // reuses src/server/project-finance.ts (Projects hub's own summary) — not duplicated, just read
    spendingBillsCount: spendingBills.length,
    cashFlowMinor: cashInMinor - cashOutMinor,
  };
}

// -------------------------------------------------------------------------
// Spendings summary
// -------------------------------------------------------------------------

export async function getSpendingsSummary(tenantId: string, companyId?: string) {
  const where = { tenantId, companyId };
  const [pending, approved, paid, overBudget] = await Promise.all([
    db.spendingBill.aggregate({ where: { ...where, status: { in: ["PENDING_SUPERIOR", "PENDING_FINANCE"] } }, _sum: { amountMinor: true }, _count: true }),
    db.spendingBill.aggregate({ where: { ...where, status: "APPROVED_FOR_PAYMENT" }, _sum: { amountMinor: true }, _count: true }),
    db.spendingBill.aggregate({ where: { ...where, status: "PAID" }, _sum: { amountMinor: true }, _count: true }),
    db.spendingBill.count({ where: { ...where, overBudget: true, status: { notIn: ["PAID", "REJECTED", "DRAFT"] } } }),
  ]);
  return {
    pendingApprovalCount: pending._count,
    pendingApprovalAmountMinor: pending._sum.amountMinor ?? 0,
    approvedForPaymentCount: approved._count,
    approvedForPaymentAmountMinor: approved._sum.amountMinor ?? 0,
    paidCount: paid._count,
    paidAmountMinor: paid._sum.amountMinor ?? 0,
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

  const revenueMinor = invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
  const expensesMinor = invoices
    .filter((i) => i.type === "EXPENSE" || i.type === "BILL")
    .reduce((s, i) => s + Math.abs(i.amountMinor), 0);
  const netProfitMinor = revenueMinor - expensesMinor;
  const cashBalanceMinor = accounts.reduce((s, a) => s + toMinorUnits(a.balance, a.currency), 0);
  const outstanding = invoices.filter((i) => i.type === "INVOICE" && i.status !== "PAID");
  const outstandingAmountMinor = outstanding.reduce((s, i) => s + i.amountMinor, 0);

  const revenueByProject = projects
    .map((p) => ({
      label: p.name,
      valueMinor: p.invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0),
    }))
    .filter((p) => p.valueMinor > 0)
    .sort((a, b) => b.valueMinor - a.valueMinor);

  const upcomingPayments = invoices
    .filter((i) => (i.type === "BILL" || i.type === "EXPENSE") && i.status !== "COMPLETED" && i.dueDate)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
    .slice(0, 4);

  return {
    revenueMinor,
    expensesMinor,
    netProfitMinor,
    cashBalanceMinor,
    outstandingAmountMinor,
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
    const actualRevenueMinor = p.invoices.filter((i) => i.type === "INVOICE").reduce((s, i) => s + i.amountMinor, 0);
    const actualExpensesMinor = p.invoices
      .filter((i) => i.type === "EXPENSE" || i.type === "BILL")
      .reduce((s, i) => s + Math.abs(i.amountMinor), 0);
    return {
      id: p.id,
      name: p.name,
      // Project.budget is still a decimal Float; converting here keeps the
      // budget-vs-actual comparison on this row in one unit.
      budgetMinor: toMinorUnits(p.budget ?? 0),
      actualRevenueMinor,
      actualExpensesMinor,
    };
  });
}

function buildMonthlyCashFlow(invoices: { amountMinor: number; type: string; issuedDate: Date }[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = new Map<string, { revenueMinor: number; expensesMinor: number }>();
  for (const m of months) byMonth.set(m, { revenueMinor: 0, expensesMinor: 0 });

  for (const inv of invoices) {
    const label = months[inv.issuedDate.getMonth()];
    const entry = byMonth.get(label)!;
    if (inv.type === "INVOICE") entry.revenueMinor += inv.amountMinor;
    else entry.expensesMinor += Math.abs(inv.amountMinor);
  }

  const currentMonth = new Date().getMonth();
  return months.slice(0, currentMonth + 1).map((label) => ({ label, ...byMonth.get(label)! }));
}
