import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toPaginatedResult, type PageParams } from "@/lib/pagination";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import { NORMAL_BALANCE_BY_TYPE, type AccountType } from "@/lib/finance-constants";
import {
  startWorkflow,
  decide,
  getActiveWorkflowInstance,
  confirmSourceFinalization,
  listMyWorkItems,
  type DecisionValue,
} from "@/server/workflow-engine";
import { toMinorUnits } from "@/lib/money";

// Finance — the single write/CRUD surface for the domain. Consolidated from
// the former finance-module.ts (accounting core), finance-budget.ts,
// finance-spendings.ts and finance-other.ts; those splits carried no
// behavioral justification, only build order.
//
// Two sibling files remain, each for a stated reason:
//   - finance-dashboard.ts — read-only aggregation/read models. Kept apart so
//     that adding a KPI never risks touching posting or approval logic.
//   - finance-payroll.ts   — payroll touchpoint, compliance-sensitive and
//     deliberately isolated from general finance writes.

// -------------------------------------------------------------------------
// Invoices & Assets — list helpers over the legacy Invoice model
// -------------------------------------------------------------------------

export async function listInvoicesByType(tenantId: string, type: "INVOICE" | "BILL" | "PAYMENT") {
  return db.invoice.findMany({
    where: { tenantId, type },
    orderBy: { issuedDate: "desc" },
    include: { project: true },
  });
}

/**
 * Paginated sibling of listInvoicesByType. Phase 4 Priority 1 — an invoice
 * table only ever grows, and three routes (invoices, bills, payments) all read
 * the whole tenant's history through this one function.
 */
export async function listInvoicesByTypePage(tenantId: string, type: "INVOICE" | "BILL" | "PAYMENT", params: PageParams) {
  const where = { tenantId, type };
  const [items, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { issuedDate: "desc" }, include: { project: true }, skip: params.skip, take: params.take }),
    db.invoice.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function listTaxRelated(tenantId: string) {
  return db.invoice.findMany({
    where: { tenantId, OR: [{ description: { contains: "Tax", mode: "insensitive" as const } }, { number: { contains: "TAX", mode: "insensitive" as const } }] },
    orderBy: { issuedDate: "desc" },
  });
}

/** Paginated sibling of listTaxRelated — same growth profile as the invoice list it filters. */
export async function listTaxRelatedPage(tenantId: string, params: PageParams) {
  const where = { tenantId, OR: [{ description: { contains: "Tax", mode: "insensitive" as const } }, { number: { contains: "TAX", mode: "insensitive" as const } }] };
  const [items, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { issuedDate: "desc" }, skip: params.skip, take: params.take }),
    db.invoice.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function listAssets(tenantId: string) {
  return db.asset.findMany({
    where: { tenantId },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
}

// -------------------------------------------------------------------------
// Accounting Core — Chart of Accounts, Cost Centers, Periods, Journal
// -------------------------------------------------------------------------
// PRD_Finance_Module §6-9. Deliberately parallel to, and never touching, the
// existing Invoice/FinancialLedgerEntry records above.

const BALANCE_TOLERANCE = 0.005; // half a cent, to absorb float rounding

async function logFinanceActivity(input: {
  tenantId: string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  eventType: string;
  summary: string;
}) {
  await db.financeActivity.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
    },
  });
}

/** Local, self-contained sequence — deliberately not routed through
 * src/server/number-series.ts's SERIES_CONFIG (a file with concurrent,
 * uncommitted edits from other in-progress work) so this module never has
 * to touch it. Same atomic upsert-and-increment shape. */
async function allocateJournalNumber(tenantId: string): Promise<string> {
  const entityType = "JOURNAL";
  const year = new Date().getFullYear();
  const sequence = await db.$transaction(async (tx) => {
    const existing = await tx.numberSeries.findUnique({ where: { tenantId_entityType: { tenantId, entityType } } });
    if (!existing) {
      await tx.numberSeries.create({ data: { tenantId, entityType, prefix: "JE", nextValue: 2 } });
      return 1;
    }
    await tx.numberSeries.update({ where: { id: existing.id }, data: { nextValue: { increment: 1 } } });
    return existing.nextValue;
  });
  return `JE-${year}-${String(sequence).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------

export async function listAccounts(tenantId: string) {
  return db.account.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
}

export async function createAccount(
  tenantId: string,
  input: { code: string; name: string; type: AccountType; parentId?: string; costCenterRequired?: boolean }
) {
  const code = input.code.trim();
  const existing = await db.account.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw new Error(`Account code ${code} is already in use.`);

  return db.account.create({
    data: {
      tenantId,
      code,
      name: input.name.trim(),
      type: input.type,
      parentId: input.parentId || null,
      normalBalance: NORMAL_BALANCE_BY_TYPE[input.type],
      costCenterRequired: input.costCenterRequired ?? false,
    },
  });
}

// ---------------------------------------------------------------------------
// Cost Centers
// ---------------------------------------------------------------------------

export async function listCostCenters(tenantId: string) {
  return db.costCenter.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
}

export async function createCostCenter(tenantId: string, input: { code: string; name: string; parentId?: string }) {
  const code = input.code.trim();
  const existing = await db.costCenter.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw new Error(`Cost center code ${code} is already in use.`);
  return db.costCenter.create({ data: { tenantId, code, name: input.name.trim(), parentId: input.parentId || null } });
}

// ---------------------------------------------------------------------------
// Fiscal Periods
// ---------------------------------------------------------------------------

export async function listFiscalPeriods(tenantId: string) {
  return db.fiscalPeriod.findMany({ where: { tenantId }, orderBy: { startAt: "desc" } });
}

export async function createFiscalPeriod(tenantId: string, input: { name: string; startAt: Date; endAt: Date }) {
  if (input.endAt <= input.startAt) throw new Error("End date must be after the start date.");
  const name = input.name.trim();
  const existing = await db.fiscalPeriod.findUnique({ where: { tenantId_name: { tenantId, name } } });
  if (existing) throw new Error(`A fiscal period named "${name}" already exists.`);
  return db.fiscalPeriod.create({ data: { tenantId, name, startAt: input.startAt, endAt: input.endAt } });
}

/** Idempotently ensures the current calendar month has an OPEN period, so
 * journal entry creation always has somewhere to post into. Safe to re-run. */
export async function ensureCurrentFiscalPeriod(tenantId: string) {
  const now = new Date();
  const name = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const existing = await db.fiscalPeriod.findUnique({ where: { tenantId_name: { tenantId, name } } });
  if (existing) return existing;

  const startAt = new Date(now.getFullYear(), now.getMonth(), 1);
  const endAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return db.fiscalPeriod.create({ data: { tenantId, name, startAt, endAt } });
}

export async function updateFiscalPeriodStatus(tenantId: string, input: { periodId: string; status: string; actorId: string }) {
  const period = assertTenant(await db.fiscalPeriod.findUnique({ where: { id: input.periodId } }), tenantId, "FiscalPeriod");
  const updated = await db.fiscalPeriod.update({ where: { id: input.periodId }, data: { status: input.status } });
  await logFinanceActivity({
    tenantId,
    entityType: "FiscalPeriod",
    entityId: period.id,
    actorId: input.actorId,
    eventType: "PERIOD_STATUS_CHANGED",
    summary: `Period "${period.name}" -> ${input.status}`,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------

export async function getJournalEntryDetail(tenantId: string, journalEntryId: string) {
  const entry = assertTenant(
    await db.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: {
        period: true,
        createdBy: { select: { id: true, displayName: true, avatarColor: true } },
        postedBy: { select: { id: true, displayName: true } },
        reversesEntry: { select: { id: true, number: true } },
        reversedBy: { select: { id: true, number: true } },
        lines: { include: { account: true, costCenter: true } },
      },
    }),
    tenantId,
    "JournalEntry"
  );
  const activity = await db.financeActivity.findMany({
    where: { tenantId, entityType: "JournalEntry", entityId: journalEntryId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, displayName: true, avatarColor: true } } },
  });
  return { ...entry, activity };
}

const JOURNAL_ENTRY_INCLUDE = {
  period: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  lines: { select: { debit: true, credit: true } },
} as const;

export async function listJournalEntries(tenantId: string) {
  return db.journalEntry.findMany({ where: { tenantId }, orderBy: { date: "desc" }, include: JOURNAL_ENTRY_INCLUDE });
}

// Phase 4 — a general ledger only grows; it is the textbook case for "tens of
// thousands of rows within a couple of years of real use", and accounting
// software does not get to skip pagination here. The unbounded version above
// stays for callers that genuinely need the whole ledger (trial balance,
// exports); screens use this.
export async function listJournalEntriesPage(tenantId: string, params: PageParams) {
  const where = { tenantId };
  const [items, total] = await Promise.all([
    db.journalEntry.findMany({ where, orderBy: { date: "desc" }, include: JOURNAL_ENTRY_INCLUDE, skip: params.skip, take: params.take }),
    db.journalEntry.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function createJournalEntry(
  tenantId: string,
  input: {
    date?: Date;
    periodId: string;
    description: string;
    sourceModule?: string;
    sourceId?: string;
    createdById: string;
    lines: { accountId: string; debit?: number; credit?: number; costCenterId?: string; description?: string }[];
  }
) {
  const description = input.description.trim();
  if (!description) throw new Error("Enter a description.");
  const period = assertTenant(await db.fiscalPeriod.findUnique({ where: { id: input.periodId } }), tenantId, "FiscalPeriod");
  if (period.status !== "OPEN") throw new Error(`Period "${period.name}" is not open for new entries.`);

  const validLines = input.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  if (validLines.length < 2) throw new Error("A journal entry needs at least two lines.");
  for (const line of validLines) {
    if ((line.debit ?? 0) > 0 && (line.credit ?? 0) > 0) {
      throw new Error("A line cannot carry both a debit and a credit amount.");
    }
  }

  const number = await allocateJournalNumber(tenantId);
  const entry = await db.journalEntry.create({
    data: {
      tenantId,
      number,
      date: input.date ?? new Date(),
      periodId: input.periodId,
      description,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      createdById: input.createdById,
      lines: {
        create: validLines.map((l) => ({
          tenantId,
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          costCenterId: l.costCenterId || null,
          description: l.description,
        })),
      },
    },
  });

  await logFinanceActivity({
    tenantId,
    entityType: "JournalEntry",
    entityId: entry.id,
    actorId: input.createdById,
    eventType: "CREATED",
    summary: `Journal entry ${entry.number} created`,
  });
  return entry;
}

/**
 * §8 "Posted journals are immutable." Validates the entry balances (total
 * debits = total credits) and that its period is still OPEN, then locks it.
 * This is the only path that may ever set status=POSTED.
 */
export async function postJournalEntry(tenantId: string, input: { journalEntryId: string; actorId: string }) {
  const entry = assertTenant(
    await db.journalEntry.findUnique({ where: { id: input.journalEntryId }, include: { lines: true, period: true } }),
    tenantId,
    "JournalEntry"
  );
  if (entry.status === "POSTED") throw new Error("This journal entry is already posted.");
  if (entry.status === "REVERSED") throw new Error("A reversed journal entry cannot be posted.");
  if (entry.period.status !== "OPEN") throw new Error(`Period "${entry.period.name}" is not open — cannot post into it.`);
  if (entry.lines.length === 0) throw new Error("Add at least one line before posting.");

  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
    throw new Error(`Entry does not balance: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}.`);
  }

  const posted = await db.journalEntry.update({
    where: { id: entry.id },
    data: { status: "POSTED", postedAt: new Date(), postedById: input.actorId },
  });
  await logFinanceActivity({
    tenantId,
    entityType: "JournalEntry",
    entityId: entry.id,
    actorId: input.actorId,
    eventType: "POSTED",
    summary: `Journal entry ${entry.number} posted (${totalDebit.toFixed(2)} ${entry.lines[0]?.currency ?? "EUR"})`,
  });
  return posted;
}

/**
 * A posted entry is never edited — reversing creates a brand-new, already-
 * posted entry with every line's debit/credit swapped, linked back via
 * reversesEntryId, and flips the original to REVERSED. History is preserved
 * in full on both sides.
 */
export async function reverseJournalEntry(tenantId: string, input: { journalEntryId: string; actorId: string; reason?: string }) {
  const entry = assertTenant(
    await db.journalEntry.findUnique({ where: { id: input.journalEntryId }, include: { lines: true } }),
    tenantId,
    "JournalEntry"
  );
  if (entry.status !== "POSTED") throw new Error("Only a posted journal entry can be reversed.");

  const period = await ensureCurrentFiscalPeriod(tenantId);
  const number = await allocateJournalNumber(tenantId);

  const reversal = await db.$transaction(async (tx) => {
    const created = await tx.journalEntry.create({
      data: {
        tenantId,
        number,
        periodId: period.id,
        description: `Reversal of ${entry.number}${input.reason ? `: ${input.reason}` : ""}`,
        sourceModule: entry.sourceModule,
        sourceId: entry.sourceId,
        status: "POSTED",
        postedAt: new Date(),
        postedById: input.actorId,
        createdById: input.actorId,
        reversesEntryId: entry.id,
        lines: {
          create: entry.lines.map((l) => ({
            tenantId,
            accountId: l.accountId,
            debit: l.credit,
            credit: l.debit,
            costCenterId: l.costCenterId,
            description: l.description,
          })),
        },
      },
    });
    await tx.journalEntry.update({ where: { id: entry.id }, data: { status: "REVERSED" } });
    return created;
  });

  await logFinanceActivity({
    tenantId,
    entityType: "JournalEntry",
    entityId: entry.id,
    actorId: input.actorId,
    eventType: "REVERSED",
    summary: `Reversed by ${reversal.number}`,
  });
  await logFinanceActivity({
    tenantId,
    entityType: "JournalEntry",
    entityId: reversal.id,
    actorId: input.actorId,
    eventType: "CREATED",
    summary: `Reversal of ${entry.number}, posted automatically`,
  });
  return reversal;
}

// -------------------------------------------------------------------------
// Budgets — PRD_Finance_Dashboard §13
// -------------------------------------------------------------------------

export async function listBudgets(tenantId: string, companyId?: string) {
  return db.budget.findMany({
    where: { tenantId, companyId },
    orderBy: [{ projectId: "asc" }, { period: "desc" }],
    include: { project: { select: { id: true, name: true } }, createdBy: { select: { id: true, displayName: true } }, _count: { select: { revisions: true, spendingBills: true } } },
  });
}

export async function getBudget(tenantId: string, budgetId: string) {
  const budget = assertTenant(
    await db.budget.findUnique({
      where: { id: budgetId },
      include: {
        project: { select: { id: true, name: true } },
        revisions: { orderBy: { revisedAt: "desc" }, include: { revisedBy: { select: { id: true, displayName: true } } } },
      },
    }),
    tenantId,
    "Budget"
  );
  const committed = await db.spendingBill.aggregate({
    where: { tenantId, budgetId, status: { in: ["PENDING_SUPERIOR", "PENDING_FINANCE", "APPROVED_FOR_PAYMENT"] } },
    _sum: { amountMinor: true },
  });
  const actual = await db.spendingBill.aggregate({ where: { tenantId, budgetId, status: "PAID" }, _sum: { amountMinor: true } });
  const committedAmountMinor = committed._sum.amountMinor ?? 0;
  const actualAmountMinor = actual._sum.amountMinor ?? 0;
  // Budget.baselineAmount is still a decimal Float while spending is in minor
  // units; subtracting one from the other gave a "remaining" that was wrong by
  // a factor of 100 and usually negative.
  const baselineMinor = toMinorUnits(budget.baselineAmount, budget.currency);
  return {
    ...budget,
    baselineAmountMinor: baselineMinor,
    committedMinor: committedAmountMinor,
    actualMinor: actualAmountMinor,
    remainingMinor: baselineMinor - committedAmountMinor - actualAmountMinor,
    varianceMinor: baselineMinor - actualAmountMinor,
  };
}

export async function createBudget(
  tenantId: string,
  actorId: string,
  input: { companyId: string; projectId?: string | null; period: string; baselineAmount: number; currency: string; costCenter?: string }
) {
  if (input.baselineAmount <= 0) throw new Error("Baseline amount must be positive.");
  return db.budget.create({
    data: {
      tenantId,
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      period: input.period,
      baselineAmount: input.baselineAmount,
      currency: input.currency,
      costCenter: input.costCenter,
      createdById: actorId,
    },
  });
}

/** A budget "edit" is always a revision — never an in-place overwrite of the approved baseline (FIN-DASH-009). */
export async function reviseBudget(tenantId: string, actorId: string, input: { budgetId: string; newAmount: number; reason?: string }) {
  if (input.newAmount <= 0) throw new Error("Revised amount must be positive.");
  const budget = assertTenant(await db.budget.findUnique({ where: { id: input.budgetId } }), tenantId, "Budget");

  return db.$transaction(async (tx) => {
    await tx.budgetRevision.create({
      data: {
        tenantId,
        budgetId: budget.id,
        previousAmount: budget.baselineAmount,
        newAmount: input.newAmount,
        reason: input.reason,
        revisedById: actorId,
      },
    });
    // Phase 1 Track B — only actions/finance.ts wrote AuditEvent rows, and
    // only for what that one file covered. A budget revision moves the number
    // everything else is measured against.
    await logAudit({ tenantId, actorId, action: "finance.budget.revised", targetType: "Budget", targetId: budget.id,
      metadata: { previousAmount: budget.baselineAmount, newAmount: input.newAmount, reason: input.reason ?? null } }, tx);
    return tx.budget.update({ where: { id: budget.id }, data: { baselineAmount: input.newAmount } });
  });
}

export async function closeBudget(tenantId: string, budgetId: string) {
  const budget = assertTenant(await db.budget.findUnique({ where: { id: budgetId } }), tenantId, "Budget");
  // Closing is what makes a budget reject further posting, so it is a one-way
  // door and must not be re-enterable by a second caller racing the first.
  if (budget.status === "CLOSED") throw new Error("This budget is already closed.");
  const closed = await db.budget.updateMany({ where: { id: budgetId, status: "ACTIVE" }, data: { status: "CLOSED" } });
  if (closed.count === 0) throw new Error("This budget was closed by someone else. Reload and try again.");
  return db.budget.findUniqueOrThrow({ where: { id: budgetId } });
}

// -------------------------------------------------------------------------
// Spending Bills — PRD_Finance_Dashboard §11/§21
// -------------------------------------------------------------------------

const WORKFLOW_KEY = "SPENDING_BILL_APPROVAL";

async function ensureSpendingWorkflowDefinition(tenantId: string, actorId: string) {
  const existing = await db.workflowDefinition.findUnique({ where: { tenantId_key: { tenantId, key: WORKFLOW_KEY } } });
  if (existing) return existing;
  return db.workflowDefinition.create({
    data: {
      tenantId,
      key: WORKFLOW_KEY,
      name: "Spending Bill Approval",
      sourceModule: "FINANCE",
      sourceEntityType: "SpendingBill",
      createdById: actorId,
      isActive: true,
      stages: {
        create: [
          { sequence: 1, name: "Superior Approval", approverRole: "OWNER" },
          { sequence: 2, name: "Finance Approval", approverRole: "FINANCE" },
        ],
      },
    },
  });
}

async function logActivity(tenantId: string, actorId: string | undefined, spendingBillId: string, eventType: string, summary: string) {
  await db.financeActivity.create({ data: { tenantId, entityType: "SpendingBill", entityId: spendingBillId, actorId, eventType, summary } });
}

// ---------------------------------------------------------------------------
// Budget resolution (§13 "Spending Bill check")
// ---------------------------------------------------------------------------

async function resolveActiveBudget(tenantId: string, companyId: string, projectId: string | null | undefined) {
  if (projectId) {
    const projectBudget = await db.budget.findFirst({ where: { tenantId, projectId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    if (projectBudget) return projectBudget;
  }
  return db.budget.findFirst({ where: { tenantId, companyId, projectId: null, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
}

/**
 * `additionalAmountMinor` and the aggregate are both integer minor units; the
 * baseline is still a decimal Float, so it is converted rather than compared
 * raw. Comparing minor-unit spend against a major-unit baseline flagged almost
 * every bill as over budget, and that flag drives approval routing.
 */
async function computeOverBudget(tenantId: string, budgetId: string, additionalAmountMinor: number) {
  const budget = await db.budget.findUniqueOrThrow({ where: { id: budgetId } });
  const committed = await db.spendingBill.aggregate({
    where: { tenantId, budgetId, status: { in: ["PENDING_SUPERIOR", "PENDING_FINANCE", "APPROVED_FOR_PAYMENT", "PAID"] } },
    _sum: { amountMinor: true },
  });
  const usedMinor = (committed._sum.amountMinor ?? 0) + additionalAmountMinor;
  return usedMinor > toMinorUnits(budget.baselineAmount, budget.currency);
}

// ---------------------------------------------------------------------------
// Spending Bill CRUD + lifecycle
// ---------------------------------------------------------------------------

export async function createSpendingBill(
  tenantId: string,
  actorId: string,
  input: {
    companyId: string;
    projectId?: string | null;
    category: string;
    amount: number;
    currency: string;
    supplierId?: string | null;
    description?: string;
    evidenceDataUrl?: string | null;
    evidenceWaived?: boolean;
    costCenter?: string;
  }
) {
  if (input.amount <= 0) throw new Error("Amount must be positive.");
  if (!input.evidenceDataUrl && !input.evidenceWaived) {
    throw new Error("Evidence attachment is required, or explicitly waive it.");
  }
  const number = await allocateNumber(tenantId, "SPENDING_BILL");
  const budget = await resolveActiveBudget(tenantId, input.companyId, input.projectId);

  const bill = await db.spendingBill.create({
    data: {
      tenantId,
      number,
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      category: input.category,
      amountMinor: toMinorUnits(input.amount, input.currency),
      currency: input.currency,
      supplierId: input.supplierId ?? null,
      description: input.description,
      evidenceDataUrl: input.evidenceDataUrl,
      evidenceWaived: input.evidenceWaived ?? false,
      costCenter: input.costCenter,
      budgetId: budget?.id,
      submitterId: actorId,
      status: "DRAFT",
    },
  });
  await logActivity(tenantId, actorId, bill.id, "CREATED", `Spending Bill ${number} created as draft`);
  return bill;
}

export async function submitSpendingBill(tenantId: string, actorId: string, spendingBillId: string) {
  const bill = assertTenant(await db.spendingBill.findUnique({ where: { id: spendingBillId } }), tenantId, "SpendingBill");
  if (bill.status !== "DRAFT") throw new Error("Only a draft Spending Bill can be submitted.");

  const overBudget = bill.budgetId ? await computeOverBudget(tenantId, bill.budgetId, bill.amountMinor) : false;
  await ensureSpendingWorkflowDefinition(tenantId, actorId);
  await startWorkflow(tenantId, actorId, { workflowDefinitionKey: WORKFLOW_KEY, sourceEntityId: bill.id });

  const updated = await db.spendingBill.update({
    where: { id: bill.id },
    data: { status: "PENDING_SUPERIOR", overBudget },
  });
  await logActivity(tenantId, actorId, bill.id, "SUBMITTED", overBudget ? "Submitted for superior approval (over budget)" : "Submitted for superior approval");
  return updated;
}

/** Superior or Finance decision — routed through the shared Workflow Engine. */
export async function decideSpendingBill(
  tenantId: string,
  actorId: string,
  actorRole: string,
  spendingBillId: string,
  decision: DecisionValue,
  comment?: string
) {
  const bill = assertTenant(await db.spendingBill.findUnique({ where: { id: spendingBillId } }), tenantId, "SpendingBill");
  const instance = await getActiveWorkflowInstance(tenantId, "FINANCE", "SpendingBill", bill.id);
  if (!instance) throw new Error("No active approval workflow for this Spending Bill.");
  const activeStage = instance.stages.find((s) => s.status === "ACTIVE");
  if (!activeStage) throw new Error("No stage is currently awaiting a decision.");

  const result = await decide(tenantId, actorId, actorRole, activeStage.id, decision, comment);

  if (decision === "REJECT" || decision === "RETURN") {
    const updated = await db.spendingBill.update({
      where: { id: bill.id },
      data: { status: "REJECTED", rejectionReason: comment },
    });
    await logActivity(tenantId, actorId, bill.id, "REJECTED", comment ? `Rejected: ${comment}` : "Rejected");
    return updated;
  }

  // APPROVE
  if (activeStage.sequence === 1) {
    const updated = await db.spendingBill.update({
      where: { id: bill.id },
      data: { status: "PENDING_FINANCE", superiorApproverId: actorId, superiorDecidedAt: new Date() },
    });
    await logActivity(tenantId, actorId, bill.id, "SUPERIOR_APPROVED", "Superior approval granted");
    return updated;
  }

  // Final (Finance) stage approved -> workflow is SOURCE_FINALIZATION_PENDING.
  const updated = await db.spendingBill.update({
    where: { id: bill.id },
    data: { status: "APPROVED_FOR_PAYMENT", financeApproverId: actorId, financeDecidedAt: new Date() },
  });
  if (result.status === "SOURCE_FINALIZATION_PENDING") {
    await confirmSourceFinalization(tenantId, actorId, result.id);
  }
  await logActivity(tenantId, actorId, bill.id, "FINANCE_APPROVED", "Finance approval granted — approved for payment");
  return updated;
}

export async function markSpendingBillPaid(
  tenantId: string,
  actorId: string,
  input: { spendingBillId: string; transferReference: string }
) {
  const bill = assertTenant(await db.spendingBill.findUnique({ where: { id: input.spendingBillId } }), tenantId, "SpendingBill");
  if (bill.status !== "APPROVED_FOR_PAYMENT") throw new Error("Only a Spending Bill approved for payment can be marked paid.");
  if (!input.transferReference.trim()) throw new Error("A transfer reference is required to mark this paid.");

  // allocateNumber opens its own db.$transaction — must run before (not
  // inside) this one, or SQLite deadlocks waiting on its own write lock
  // (same class of bug already found/fixed in HSE/Payroll activity logging).
  const number = await allocateNumber(tenantId, "PAYMENT");

  return db.$transaction(async (tx) => {
    // Authoritative Finance payment record — Spending Bill references it,
    // never replaces it (§12 "No duplicate monetary truth").
    const payment = await tx.invoice.create({
      data: {
        tenantId,
        projectId: bill.projectId,
        number,
        type: "PAYMENT",
        description: `Spending Bill ${bill.number} — ${bill.category}`,
        // Already minor units on SpendingBill — converting again made the payment 100x the bill.
        amountMinor: bill.amountMinor,
        currency: bill.currency,
        status: "COMPLETED",
        postedAt: new Date(),
        postedById: actorId,
      },
    });
    const updated = await tx.spendingBill.update({
      where: { id: bill.id },
      data: { status: "PAID", paidAt: new Date(), transferReference: input.transferReference, paymentId: payment.id },
    });
    await tx.financeActivity.create({
      data: { tenantId, entityType: "SpendingBill", entityId: bill.id, actorId, eventType: "PAID", summary: `Marked paid — transfer ref ${input.transferReference}` },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Reads — §11.1 the nine Spendings page views
// ---------------------------------------------------------------------------

const LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  submitter: { select: { id: true, displayName: true, avatarColor: true } },
  budget: { select: { id: true, period: true, baselineAmount: true } },
} as const;

export async function listSpendingBills(tenantId: string, companyId?: string, filter?: { status?: string | string[]; overBudget?: boolean }) {
  return db.spendingBill.findMany({
    where: {
      tenantId,
      companyId,
      ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}),
      ...(filter?.overBudget !== undefined ? { overBudget: filter.overBudget } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: LIST_INCLUDE,
  });
}

export async function getSpendingBill(tenantId: string, spendingBillId: string) {
  const bill = assertTenant(
    await db.spendingBill.findUnique({ where: { id: spendingBillId }, include: LIST_INCLUDE }),
    tenantId,
    "SpendingBill"
  );
  const instance = await getActiveWorkflowInstance(tenantId, "FINANCE", "SpendingBill", bill.id);
  const activity = await db.financeActivity.findMany({
    where: { tenantId, entityType: "SpendingBill", entityId: bill.id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, displayName: true } } },
  });
  return { ...bill, workflowInstance: instance, activity };
}

export async function listMySpendingReviewItems(tenantId: string, userId: string, role: string) {
  const items = await listMyWorkItems(tenantId, userId, role);
  const spendingItems = items.filter((i) => i.workflowInstance.sourceEntityType === "SpendingBill");
  const billIds = spendingItems.map((i) => i.workflowInstance.sourceEntityId);
  if (billIds.length === 0) return [];
  return db.spendingBill.findMany({ where: { tenantId, id: { in: billIds } }, include: LIST_INCLUDE });
}

// -------------------------------------------------------------------------
// Loans & Investments — PRD_Finance_Dashboard §4 "Other"
// -------------------------------------------------------------------------

export async function listLoans(tenantId: string, companyId?: string) {
  return db.loan.findMany({ where: { tenantId, companyId }, orderBy: { startDate: "desc" } });
}

export async function createLoan(
  tenantId: string,
  actorId: string,
  input: {
    companyId: string;
    lender: string;
    principal: number;
    currency: string;
    interestRate?: number;
    outstanding: number;
    startDate: Date;
    maturityDate?: Date | null;
    notes?: string;
  }
) {
  return db.loan.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function listInvestments(tenantId: string, companyId?: string) {
  return db.investment.findMany({ where: { tenantId, companyId }, orderBy: { startDate: "desc" } });
}

export async function createInvestment(
  tenantId: string,
  actorId: string,
  input: {
    companyId: string;
    name: string;
    type: string;
    amount: number;
    currency: string;
    currentValue?: number;
    startDate: Date;
    maturityDate?: Date | null;
    notes?: string;
  }
) {
  return db.investment.create({ data: { tenantId, createdById: actorId, ...input } });
}
