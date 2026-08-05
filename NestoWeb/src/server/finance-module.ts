import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { NORMAL_BALANCE_BY_TYPE, type AccountType } from "@/lib/finance-constants";

// PRD_Finance_Module — "Accounting Core" (§6-9): Chart of Accounts, Cost
// Centers, Fiscal Periods, and double-entry Journal Entries. Deliberately
// parallel to, and never touching, the existing Invoice/FinancialLedgerEntry
// pipeline (src/server/contract-lifecycle-reactions.ts's Audit 2 reference
// workflow) — see the schema comment above the Account model for the full
// data-ownership rationale.

export { ACCOUNT_TYPES, JOURNAL_STATUSES, FISCAL_PERIOD_STATUSES } from "@/lib/finance-constants";

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

export async function listJournalEntries(tenantId: string) {
  return db.journalEntry.findMany({
    where: { tenantId },
    orderBy: { date: "desc" },
    include: {
      period: { select: { id: true, name: true } },
      createdBy: { select: { id: true, displayName: true } },
      lines: { select: { debit: true, credit: true } },
    },
  });
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
