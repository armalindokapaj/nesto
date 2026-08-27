import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { canViewTask, type TaskVisibilityRecord } from "@/lib/project-access";
import { getPipelineBoard, getCrmActivityFeed } from "@/server/crm-module";

// PRD_Sales_Dashboard §25 — GET /crm/overview. Sections 8-19 lock the exact
// composition; this function is the single aggregation point behind that
// contract. Every group below degrades to zero/empty rather than fabricating
// a value when its source data doesn't exist yet in this tenant — never
// hidden-then-fake.

export type CrmOverviewViewer = { userId: string; role: Role };

const CLOSED_TASK_STATUSES = new Set(["COMPLETED", "APPROVED", "REJECTED"]);

export async function getCrmOverview(tenantId: string, viewer: CrmOverviewViewer) {
  const canSeeFinance = can(viewer.role, "FINANCE", "READ");

  const [
    totalClients,
    activeClients,
    newLeads,
    qualifiedLeads,
    openOpportunities,
    pipelineValueAgg,
    activeReservations,
    clientContracts,
    unitsSold,
    { pipeline, stages },
    leads,
    opportunities,
    reservations,
    relationships,
    clientLinkedTasks,
    upcomingMeetings,
    recentActivityRaw,
  ] = await Promise.all([
    db.client.count({ where: { tenantId, archivedAt: null } }),
    db.client.count({ where: { tenantId, archivedAt: null, status: "ACTIVE" } }),
    db.lead.count({ where: { tenantId, status: "NEW" } }),
    db.lead.count({ where: { tenantId, status: "QUALIFIED" } }),
    db.opportunity.count({ where: { tenantId, status: "OPEN" } }),
    db.opportunity.aggregate({ where: { tenantId, status: "OPEN" }, _sum: { estimatedValue: true } }),
    db.clientUnitRelationship.count({ where: { tenantId, type: "RESERVED", reservationStatus: "ACTIVE" } }),
    db.contractParty.findMany({
      where: { tenantId, partyEntityType: "CLIENT" },
      select: { contractId: true, partyEntityId: true },
    }),
    db.unit.count({ where: { tenantId, lifecycleStatus: { in: ["SOLD", "HANDED_OVER"] } } }),
    getPipelineBoard(tenantId),
    db.lead.findMany({
      where: { tenantId, status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { owner: { select: { id: true, displayName: true } }, client: { select: { id: true, name: true } } },
    }),
    db.opportunity.findMany({
      where: { tenantId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { client: { select: { id: true, name: true } }, stage: true, owner: { select: { id: true, displayName: true } } },
    }),
    db.clientUnitRelationship.findMany({
      where: { tenantId, type: "RESERVED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        client: { select: { id: true, name: true } },
        unit: { select: { id: true, code: true, project: { select: { id: true, name: true } } } },
        salesperson: { select: { id: true, displayName: true } },
      },
    }),
    db.clientUnitRelationship.groupBy({ by: ["type"], where: { tenantId }, _count: { _all: true } }),
    db.task.findMany({
      where: { tenantId, clientId: { not: null }, status: { notIn: Array.from(CLOSED_TASK_STATUSES) } },
      include: {
        contributions: { select: { userId: true } },
        participants: { select: { userId: true, role: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.meeting.findMany({
      where: { tenantId, status: "PLANNED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { organiser: { select: { id: true, displayName: true } } },
    }),
    getCrmActivityFeed(tenantId, 15),
  ]);

  // --- Financial summary / Revenue / Outstanding (Finance-owned, filtered) --
  const clientContractIds = clientContracts.map((c) => c.contractId);
  let financialSummary: {
    contractValue: number;
    amountPaid: number;
    remainingBalance: number;
    overdueCount: number;
    nextPaymentDue: Date | null;
  } | null = null;
  let revenue: number | null = null;
  let outstandingPayments: number | null = null;

  if (canSeeFinance) {
    if (clientContractIds.length === 0) {
      financialSummary = { contractValue: 0, amountPaid: 0, remainingBalance: 0, overdueCount: 0, nextPaymentDue: null };
      revenue = 0;
      outstandingPayments = 0;
    } else {
      const [contractValueAgg, invoices] = await Promise.all([
        db.contract.aggregate({ where: { tenantId, id: { in: clientContractIds } }, _sum: { valueMinor: true } }),
        db.invoice.findMany({
          where: { tenantId, contractId: { in: clientContractIds } },
          select: { amountMinor: true, status: true, dueDate: true },
        }),
      ]);
      const paid = invoices.filter((i) => i.status === "POSTED" || i.status === "PAID" || i.status === "COMPLETED");
      const outstanding = invoices.filter((i) => i.status === "PENDING" || i.status === "SENT" || i.status === "OVERDUE" || i.status === "SUBMITTED");
      const amountPaid = paid.reduce((sum, i) => sum + i.amountMinor, 0);
      const outstandingAmount = outstanding.reduce((sum, i) => sum + i.amountMinor, 0);
      const contractValue = contractValueAgg._sum.valueMinor ?? 0;
      const nextDue = outstanding
        .filter((i) => i.dueDate)
        .sort((a, b) => (a.dueDate!.getTime() ?? 0) - (b.dueDate!.getTime() ?? 0))[0]?.dueDate ?? null;

      financialSummary = {
        contractValue,
        amountPaid,
        remainingBalance: Math.max(contractValue - amountPaid, 0),
        overdueCount: invoices.filter((i) => i.status === "OVERDUE").length,
        nextPaymentDue: nextDue,
      };
      revenue = amountPaid;
      outstandingPayments = outstandingAmount;
    }
  }

  // --- Conversion rate (CRM reporting) --------------------------------------
  const [wonCount, closedCount] = await Promise.all([
    db.opportunity.count({ where: { tenantId, status: "WON" } }),
    db.opportunity.count({ where: { tenantId, status: { in: ["WON", "LOST"] } } }),
  ]);
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 1000) / 10 : 0;

  // --- Contracts KPI (visible to Sales = linked to a CLIENT party) ---------
  const contractsCount = new Set(clientContractIds).size;

  // --- Work: participant-filtered open tasks --------------------------------
  const visibleTasks = clientLinkedTasks
    .filter((t) => canViewTask(t as unknown as TaskVisibilityRecord, viewer))
    .slice(0, 6)
    .map((t) => ({ id: t.id, title: t.title, status: t.status, clientId: t.clientId, dueDate: t.dueDate }));

  // --- Performance: sales by owner, lead sources ----------------------------
  const [byOwner, bySource] = await Promise.all([
    db.opportunity.groupBy({ by: ["ownerId"], where: { tenantId, status: "OPEN" }, _count: { _all: true }, _sum: { estimatedValue: true } }),
    db.lead.groupBy({ by: ["source"], where: { tenantId }, _count: { _all: true } }),
  ]);
  const ownerIds = byOwner.map((o) => o.ownerId).filter((id): id is string => !!id);
  const owners = ownerIds.length
    ? await db.userIdentity.findMany({ where: { id: { in: ownerIds } }, select: { id: true, displayName: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.displayName]));

  const relationshipCounts = Object.fromEntries(relationships.map((r) => [r.type, r._count._all]));

  return {
    context: { tenantId, generatedAt: new Date().toISOString() },
    kpis: {
      totalClients,
      activeClients,
      newLeads,
      qualifiedLeads,
      openOpportunities,
      pipelineValue: pipelineValueAgg._sum.estimatedValue ?? 0,
      reservations: activeReservations,
      contracts: contractsCount,
      unitsSold,
      revenue,
      outstandingPayments,
      conversionRate,
    },
    pipeline: {
      pipelineId: pipeline.id,
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        probability: s.probability,
        count: s.opportunities.length,
        value: s.opportunities.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0),
      })),
    },
    leads,
    opportunities,
    reservations,
    sales_units: {
      counts: {
        interested: relationshipCounts.INTERESTED ?? 0,
        viewed: relationshipCounts.VIEWED ?? 0,
        reserved: relationshipCounts.RESERVED ?? 0,
        purchased: relationshipCounts.PURCHASED ?? 0,
        rented: relationshipCounts.RENTED ?? 0,
        released: relationshipCounts.RELEASED ?? 0,
      },
    },
    financial_summary: financialSummary,
    work: {
      upcomingMeetings: upcomingMeetings.map((m) => ({ id: m.id, title: m.title, scheduledAt: m.scheduledAt, organiser: m.organiser.displayName })),
      openTasks: visibleTasks,
    },
    performance: {
      byOwner: byOwner.map((o) => ({
        ownerId: o.ownerId,
        ownerName: o.ownerId ? (ownerName.get(o.ownerId) ?? "Unassigned") : "Unassigned",
        count: o._count._all,
        value: o._sum.estimatedValue ?? 0,
      })),
      leadSources: bySource.map((s) => ({ source: s.source ?? "Unspecified", count: s._count._all })),
      conversionRate,
      pipelineValue: pipelineValueAgg._sum.estimatedValue ?? 0,
      revenue,
      unitsSold,
    },
    recent_activity: recentActivityRaw.map((e) => ({
      id: e.id,
      time: e.createdAt,
      actor: e.actor.displayName,
      event: e.eventType,
      summary: e.summary,
      context: e.client.name,
      clientId: e.clientId,
      entityType: e.entityType,
      entityId: e.entityId,
    })),
    capabilities: {
      canSeeFinance,
      canWriteClients: can(viewer.role, "CLIENTS", "WRITE"),
    },
  };
}
