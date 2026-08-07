import "server-only";
import { db } from "@/lib/db";

// PRD_Procurement_Dashboard §4/§5 — the exact six Primary Cues, My Work,
// Pipeline, Demand/Sourcing, Orders/Delivery, Supplier Health, Commercial
// Summary, Upcoming and Recent Activity regions. Reuses the existing
// procurement.ts data (already built) plus the new Comparison/Award tables.

const OPEN_REQUEST_STATUSES_EXCLUDED = ["CLOSED", "REJECTED", "CANCELLED", "ARCHIVED"];
const OPEN_RFQ_STATUSES_EXCLUDED = ["AWARDED", "CLOSED", "CANCELLED", "ARCHIVED"];
const OPEN_PO_STATUSES_EXCLUDED = ["CLOSED", "CANCELLED", "ARCHIVED"];

export async function getProcurementDashboard(tenantId: string, actorId: string) {
  const now = new Date();

  const [requests, rfqs, purchaseOrders, deliveries, suppliers, myAwardsToDecide, myComparisonsInProgress, recentActivity] = await Promise.all([
    db.purchaseRequest.findMany({ where: { tenantId, archivedAt: null }, include: { project: true, company: true }, orderBy: { createdAt: "desc" } }),
    db.procurementRfq.findMany({ where: { tenantId }, include: { _count: { select: { suppliers: true, quotations: true } } }, orderBy: { createdAt: "desc" } }),
    db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null }, include: { supplier: true, project: true }, orderBy: { createdAt: "desc" } }),
    db.procurementDelivery.findMany({ where: { tenantId }, include: { supplier: true, purchaseOrder: true }, orderBy: { expectedAt: "asc" } }),
    db.supplier.findMany({ where: { tenantId, archivedAt: null } }),
    db.awardRecommendation.findMany({ where: { tenantId, status: "SUBMITTED" }, include: { rfq: true, recommendedSupplier: true } }),
    db.procurementComparison.findMany({ where: { tenantId, status: { in: ["DRAFT", "SCORING"] }, createdById: actorId }, include: { rfq: true } }),
    db.procurementActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { id: true, displayName: true } } } }),
  ]);

  const openRequests = requests.filter((r) => !OPEN_REQUEST_STATUSES_EXCLUDED.includes(r.status));
  const openRfqs = rfqs.filter((r) => !OPEN_RFQ_STATUSES_EXCLUDED.includes(r.status));
  const openOrders = purchaseOrders.filter((po) => !OPEN_PO_STATUSES_EXCLUDED.includes(po.status));
  const deliveriesAtRisk = deliveries.filter(
    (d) => d.status === "DELAYED" || d.exceptionType || (d.expectedAt && d.expectedAt < now && !["ARRIVED", "ACCEPTED", "REJECTED", "CLOSED"].includes(d.status))
  );
  const supplierExceptions = suppliers.filter((s) => s.status === "SUSPENDED" || s.status === "BLACKLISTED" || (s.qualificationStatus === "EXPIRED"));

  // My Pending Actions — assigned requests/awards/comparisons for this actor.
  const myPendingActions = myAwardsToDecide.length + myComparisonsInProgress.length;

  return {
    cues: {
      openPurchaseRequests: openRequests.length,
      openRfqs: openRfqs.length,
      openPurchaseOrders: openOrders.length,
      deliveriesAtRisk: deliveriesAtRisk.length,
      supplierExceptions: supplierExceptions.length,
      myPendingActions,
    },
    myWork: {
      awardsToDecide: myAwardsToDecide,
      comparisonsInProgress: myComparisonsInProgress,
    },
    pipeline: {
      demand: openRequests.filter((r) => r.status === "DRAFT" || r.status === "SUBMITTED").length,
      sourcing: openRfqs.filter((r) => r.status === "ISSUED").length,
      readyToOrder: myAwardsToDecide.length,
      ordered: openOrders.length,
      delivery: deliveries.filter((d) => !["ACCEPTED", "REJECTED", "CLOSED"].includes(d.status)).length,
    },
    demandAndSourcing: {
      openRequests: openRequests.length,
      overdueRequests: openRequests.filter((r) => r.requiredBy && r.requiredBy < now).length,
      emergencyRequests: openRequests.filter((r) => r.type === "EMERGENCY_PURCHASE").length,
      openRfqs: openRfqs.length,
    },
    ordersAndDelivery: {
      openOrders: openOrders.length,
      committedValue: openOrders.reduce((sum, po) => sum + po.amount, 0),
      unacknowledgedOrders: openOrders.filter((po) => po.status === "ISSUED" && !po.acknowledgedAt).length,
      dueThisWeek: deliveries.filter((d) => d.expectedAt && d.expectedAt >= now && d.expectedAt <= new Date(now.getTime() + 7 * 86400000)).length,
      delayed: deliveries.filter((d) => d.status === "DELAYED").length,
    },
    supplierHealth: {
      qualified: suppliers.filter((s) => ["QUALIFIED", "PREFERRED"].includes(s.status)).length,
      suspended: suppliers.filter((s) => s.status === "SUSPENDED").length,
      total: suppliers.length,
    },
    commercialSummary: {
      requested: requests.reduce((sum, r) => sum + r.estimatedAmount, 0),
      committed: purchaseOrders.filter((po) => !["DRAFT", "CANCELLED", "ARCHIVED"].includes(po.status)).reduce((sum, po) => sum + po.amount, 0),
    },
    upcoming: deliveries
      .filter((d) => d.expectedAt && d.expectedAt >= now && !["ACCEPTED", "REJECTED", "CLOSED"].includes(d.status))
      .slice(0, 8),
    recentActivity,
  };
}
