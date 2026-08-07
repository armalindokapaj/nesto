import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";

// PRD_Procurement_Dashboard §10/§11 — Supplier Comparison + Award
// Recommendation. Comparison scores every received quotation on the PRD's
// fixed 8-criterion set (§10.1); award preparation and decision are kept as
// separate actors (§10.3 "Award preparation is not sole approval").

export const COMPARISON_CRITERIA = ["PRICE", "LEAD_TIME", "COMPLIANCE", "QUALITY", "HSE", "WARRANTY", "PERFORMANCE", "RISK"] as const;
export type ComparisonCriterion = (typeof COMPARISON_CRITERIA)[number];
const EQUAL_WEIGHT = 100 / COMPARISON_CRITERIA.length;

async function logProcurementActivity(tenantId: string, actorId: string, entityType: string, entityId: string, eventType: string, summary: string) {
  await db.procurementActivity.create({ data: { tenantId, actorId, entityType, entityId, eventType, summary, correlationId: crypto.randomUUID() } });
}

export async function listComparisons(tenantId: string, filter?: { rfqId?: string }) {
  return db.procurementComparison.findMany({
    where: { tenantId, rfqId: filter?.rfqId },
    orderBy: { createdAt: "desc" },
    include: { rfq: { select: { id: true, number: true, title: true } }, createdBy: { select: { id: true, displayName: true } }, scores: { select: { id: true } }, awards: { select: { id: true, status: true } } },
  });
}

export async function getComparisonDetail(tenantId: string, id: string) {
  const comparison = assertTenant(
    await db.procurementComparison.findUnique({
      where: { id },
      include: {
        rfq: { include: { quotations: { include: { supplier: true, lines: true } } } },
        scores: { include: { quotation: { include: { supplier: true } } }, orderBy: { criterion: "asc" } },
        awards: { include: { recommendedSupplier: true, preparedBy: { select: { id: true, displayName: true } }, decidedBy: { select: { id: true, displayName: true } } } },
      },
    }),
    tenantId,
    "ProcurementComparison"
  );
  return comparison;
}

export async function createComparison(tenantId: string, actorId: string, input: { rfqId: string }) {
  const rfq = assertTenant(await db.procurementRfq.findUnique({ where: { id: input.rfqId }, include: { quotations: true } }), tenantId, "ProcurementRfq");
  if (rfq.quotations.length === 0) throw new Error("At least one quotation is required before starting a comparison.");
  const number = await allocateNumber(tenantId, "PROCUREMENT_COMPARISON");
  const comparison = await db.procurementComparison.create({
    data: { tenantId, number, rfqId: input.rfqId, companyId: rfq.companyId, projectId: rfq.projectId, createdById: actorId },
  });
  await logProcurementActivity(tenantId, actorId, "COMPARISON", comparison.id, "comparison.created", `${number} started with ${rfq.quotations.length} quotation(s).`);
  return comparison;
}

/** Upserts one evaluator score per quotation+criterion. Comparison moves to
 * SCORING on the first score and stays editable until COMPLETED. */
export async function recordComparisonScore(
  tenantId: string,
  actorId: string,
  input: { comparisonId: string; quotationId: string; criterion: ComparisonCriterion; score: number }
) {
  const comparison = assertTenant(await db.procurementComparison.findUnique({ where: { id: input.comparisonId } }), tenantId, "ProcurementComparison");
  if (comparison.status === "COMPLETED") throw new Error("This comparison is already completed.");
  if (input.score < 0 || input.score > 100) throw new Error("Score must be between 0 and 100.");

  await db.procurementComparisonScore.upsert({
    where: { comparisonId_quotationId_criterion: { comparisonId: input.comparisonId, quotationId: input.quotationId, criterion: input.criterion } },
    create: { tenantId, comparisonId: input.comparisonId, quotationId: input.quotationId, criterion: input.criterion, weight: EQUAL_WEIGHT, score: input.score, evaluatedById: actorId },
    update: { score: input.score, evaluatedById: actorId, evaluatedAt: new Date() },
  });
  if (comparison.status === "DRAFT") {
    await db.procurementComparison.update({ where: { id: input.comparisonId }, data: { status: "SCORING" } });
  }
}

export async function completeComparison(tenantId: string, actorId: string, id: string) {
  const comparison = assertTenant(await db.procurementComparison.findUnique({ where: { id }, include: { rfq: { include: { quotations: true } }, scores: true } }), tenantId, "ProcurementComparison");
  if (comparison.status === "COMPLETED") throw new Error("Already completed.");
  // §10.2 "evaluation weights total 100% when weighted scoring is enabled" —
  // every quotation must have every criterion scored before completion.
  const expected = comparison.rfq.quotations.length * COMPARISON_CRITERIA.length;
  if (comparison.scores.length < expected) throw new Error(`Every quotation needs all ${COMPARISON_CRITERIA.length} criteria scored before completing (${comparison.scores.length}/${expected}).`);
  const updated = await db.procurementComparison.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  await logProcurementActivity(tenantId, actorId, "COMPARISON", id, "comparison.completed", "Comparison completed.");
  return updated;
}

/** Normalized total per quotation: sum(score * weight) / 100 — a 0-100 scale. */
export function computeNormalizedTotals(scores: { quotationId: string; criterion: string; weight: number; score: number }[]) {
  const totals = new Map<string, number>();
  for (const s of scores) {
    totals.set(s.quotationId, (totals.get(s.quotationId) ?? 0) + (s.score * s.weight) / 100);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Award Recommendation
// ---------------------------------------------------------------------------

export async function listAwardRecommendations(tenantId: string, filter?: { status?: string | string[] }) {
  return db.awardRecommendation.findMany({
    where: { tenantId, ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}) },
    orderBy: { preparedAt: "desc" },
    include: {
      rfq: { select: { id: true, number: true, title: true } },
      recommendedSupplier: { select: { id: true, name: true } },
      preparedBy: { select: { id: true, displayName: true } },
      decidedBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function getAwardDetail(tenantId: string, id: string) {
  return assertTenant(
    await db.awardRecommendation.findUnique({
      where: { id },
      include: {
        rfq: true,
        comparison: { include: { scores: true } },
        recommendedSupplier: true,
        recommendedQuotation: { include: { lines: true } },
        preparedBy: { select: { id: true, displayName: true } },
        decidedBy: { select: { id: true, displayName: true } },
        purchaseOrders: { select: { id: true, number: true } },
      },
    }),
    tenantId,
    "AwardRecommendation"
  );
}

export async function recommendAward(
  tenantId: string,
  actorId: string,
  input: { comparisonId: string; recommendedQuotationId: string; justification?: string }
) {
  const comparison = assertTenant(await db.procurementComparison.findUnique({ where: { id: input.comparisonId }, include: { rfq: true } }), tenantId, "ProcurementComparison");
  if (comparison.status !== "COMPLETED") throw new Error("Complete the comparison before recommending an award.");
  const quotation = assertTenant(await db.supplierQuotation.findUnique({ where: { id: input.recommendedQuotationId } }), tenantId, "SupplierQuotation");
  if (quotation.rfqId !== comparison.rfqId) throw new Error("The recommended quotation must belong to the same RFQ as the comparison.");

  const number = await allocateNumber(tenantId, "AWARD_RECOMMENDATION");
  const award = await db.awardRecommendation.create({
    data: {
      tenantId,
      number,
      comparisonId: input.comparisonId,
      rfqId: comparison.rfqId,
      recommendedSupplierId: quotation.supplierId,
      recommendedQuotationId: input.recommendedQuotationId,
      justification: input.justification,
      status: "SUBMITTED",
      preparedById: actorId,
    },
  });
  await logProcurementActivity(tenantId, actorId, "AWARD_RECOMMENDATION", award.id, "award.recommended", `${number} submitted.`);
  return award;
}

/** §10.3 Separation of duties — "Award preparation is not sole approval": the
 * preparer of a recommendation cannot also be its decider. */
/** Turns an APPROVED award into a real Purchase Order, copying the
 * recommended quotation's lines exactly — no re-entry, no drift between
 * what was scored/approved and what gets ordered. */
export async function createPurchaseOrderFromAward(tenantId: string, actorId: string, awardId: string) {
  const award = assertTenant(
    await db.awardRecommendation.findUnique({ where: { id: awardId }, include: { recommendedQuotation: { include: { lines: true } }, rfq: true } }),
    tenantId,
    "AwardRecommendation"
  );
  if (award.status !== "APPROVED") throw new Error("Only an approved award can be converted to a purchase order.");

  const { createPurchaseOrder } = await import("@/server/procurement");
  const quotation = award.recommendedQuotation;
  const order = await createPurchaseOrder(tenantId, actorId, {
    companyId: award.rfq.companyId,
    supplierId: award.recommendedSupplierId,
    projectId: award.rfq.projectId ?? undefined,
    rfqId: award.rfqId,
    quotationId: quotation.id,
    awardRecommendationId: award.id,
    description: `Award ${award.number} — ${award.rfq.title}`,
    currency: quotation.currency,
    lines: quotation.lines.map((l) => ({ lineType: "MATERIAL", description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice })),
  });
  await logProcurementActivity(tenantId, actorId, "AWARD_RECOMMENDATION", awardId, "award.converted_to_po", `${award.number} converted to ${order.number}.`);
  return order;
}

export async function decideAward(tenantId: string, actorId: string, id: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const award = assertTenant(await db.awardRecommendation.findUnique({ where: { id } }), tenantId, "AwardRecommendation");
  if (award.status !== "SUBMITTED") throw new Error("Only a submitted award recommendation can be decided.");
  if (award.preparedById === actorId) throw new Error("The preparer of an award recommendation cannot also decide it (separation of duties).");

  const updated = await db.awardRecommendation.update({
    where: { id },
    data: { status: decision, decidedById: actorId, decidedAt: new Date(), decisionNote: note },
  });
  await logProcurementActivity(tenantId, actorId, "AWARD_RECOMMENDATION", id, `award.${decision.toLowerCase()}`, `${award.number} ${decision.toLowerCase()}.${note ? ` ${note}` : ""}`);
  return updated;
}
