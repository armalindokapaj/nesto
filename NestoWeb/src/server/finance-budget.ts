import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Finance_Dashboard §13 — Budget Integration. Revisions preserve the
// prior baseline (FIN-DASH-009); `baselineAmount` on Budget itself always
// reflects the current approved figure, and each change appends a
// BudgetRevision row rather than being reconstructed from history.

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
    _sum: { amount: true },
  });
  const actual = await db.spendingBill.aggregate({ where: { tenantId, budgetId, status: "PAID" }, _sum: { amount: true } });
  const committedAmount = committed._sum.amount ?? 0;
  const actualAmount = actual._sum.amount ?? 0;
  return {
    ...budget,
    committed: committedAmount,
    actual: actualAmount,
    remaining: budget.baselineAmount - committedAmount - actualAmount,
    variance: budget.baselineAmount - actualAmount,
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
    return tx.budget.update({ where: { id: budget.id }, data: { baselineAmount: input.newAmount } });
  });
}

export async function closeBudget(tenantId: string, budgetId: string) {
  assertTenant(await db.budget.findUnique({ where: { id: budgetId } }), tenantId, "Budget");
  return db.budget.update({ where: { id: budgetId }, data: { status: "CLOSED" } });
}
