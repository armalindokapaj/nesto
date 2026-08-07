import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import {
  startWorkflow,
  decide,
  getActiveWorkflowInstance,
  confirmSourceFinalization,
  listMyWorkItems,
  type DecisionValue,
} from "@/server/workflow-engine";

// PRD_Finance_Dashboard §11/§21.1 — Spending Bill lifecycle, routed through
// the existing platform Workflow Engine (PRD_Approvals_Workflow_Engine)
// rather than a second approval state machine: "Finance owns the Spending
// Bill record and its financial state; Workflow owns how the decision is
// made." v1 simplification (documented, not hidden): the "Superior" stage's
// approverRole is fixed to OWNER rather than a per-submitter manager lookup
// — this app has no reporting-line/manager hierarchy to resolve dynamically.
// Real department-based routing is a Platform Configuration follow-up.

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

async function computeOverBudget(tenantId: string, budgetId: string, additionalAmount: number) {
  const budget = await db.budget.findUniqueOrThrow({ where: { id: budgetId } });
  const committed = await db.spendingBill.aggregate({
    where: { tenantId, budgetId, status: { in: ["PENDING_SUPERIOR", "PENDING_FINANCE", "APPROVED_FOR_PAYMENT", "PAID"] } },
    _sum: { amount: true },
  });
  const used = (committed._sum.amount ?? 0) + additionalAmount;
  return used > budget.baselineAmount;
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
      amount: input.amount,
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

  const overBudget = bill.budgetId ? await computeOverBudget(tenantId, bill.budgetId, bill.amount) : false;
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
        amount: bill.amount,
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
