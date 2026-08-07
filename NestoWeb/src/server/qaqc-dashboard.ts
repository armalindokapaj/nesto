import "server-only";
import { db } from "@/lib/db";
import { getQualityGates } from "@/server/qaqc";

// PRD_QAQC_Dashboard §4/§5 — the exact six Primary Cues, Needs My Attention,
// Inspection Control, NCR & CAPA Status, Defects/Snags/Punch, Quality Gates,
// Handover Readiness (stub — see honest scope note on the Handover pages),
// Upcoming and Recent Activity regions.

export async function getQaqcDashboard(tenantId: string) {
  const now = new Date();

  const [inspections, ncrs, defects, gates, recentActivity] = await Promise.all([
    db.inspectionRequest.findMany({ where: { tenantId }, include: { project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.ncr.findMany({ where: { tenantId }, include: { project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.defect.findMany({ where: { tenantId }, include: { project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    getQualityGates(tenantId),
    db.qaqcActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { id: true, displayName: true } } } }),
  ]);

  const inspectionsDue = inspections.filter((i) => i.status === "SCHEDULED" && i.plannedDate && i.plannedDate <= now);
  const openNcrs = ncrs.filter((n) => n.status !== "CLOSED");
  const openDefects = defects.filter((d) => d.status !== "CLOSED");
  const blockingGates = gates.filter((g) => g.blocking);

  return {
    cues: {
      inspectionsDue: inspectionsDue.length,
      openNcrs: openNcrs.length,
      openDefects: openDefects.length,
      overdueCorrectiveActions: ncrs.filter((n) => n.dueDate && n.dueDate < now && !["CLOSED"].includes(n.status)).length,
      blockingQualityGates: blockingGates.length,
      handoverBlockers: 0, // Handover subsystem not built this phase — never fabricated
    },
    needsMyAttention: {
      inspections: inspections.filter((i) => i.status === "REQUESTED" || i.status === "REINSPECTION_REQUIRED").slice(0, 8),
      ncrs: openNcrs.filter((n) => n.severity === "CRITICAL").slice(0, 8),
      defects: openDefects.filter((d) => d.status === "READY_FOR_REVIEW").slice(0, 8),
    },
    inspectionControl: {
      open: inspections.filter((i) => !["RESULT_ISSUED"].includes(i.status)).length,
      scheduled: inspections.filter((i) => i.status === "SCHEDULED").length,
      due: inspectionsDue.length,
      inInspection: inspections.filter((i) => i.status === "IN_INSPECTION").length,
      passed: inspections.filter((i) => i.result === "PASS" || i.result === "PASS_WITH_COMMENTS").length,
      failed: inspections.filter((i) => i.result === "FAIL").length,
      reinspectionRequired: inspections.filter((i) => i.status === "REINSPECTION_REQUIRED").length,
    },
    ncrStatus: {
      open: openNcrs.length,
      critical: openNcrs.filter((n) => n.severity === "CRITICAL").length,
      overdue: openNcrs.filter((n) => n.dueDate && n.dueDate < now).length,
      byStage: ncrs.reduce<Record<string, number>>((acc, n) => { acc[n.status] = (acc[n.status] ?? 0) + 1; return acc; }, {}),
    },
    qualityIssues: {
      open: openDefects.length,
      overdue: 0, // Defect has no due date field yet — never fabricated
      critical: openDefects.filter((d) => d.severity === "CRITICAL").length,
      readyForVerification: openDefects.filter((d) => d.status === "READY_FOR_REVIEW").length,
      byType: openDefects.reduce<Record<string, number>>((acc, d) => { acc[d.type] = (acc[d.type] ?? 0) + 1; return acc; }, {}),
    },
    qualityGates: gates,
    upcoming: inspections.filter((i) => i.plannedDate && i.plannedDate >= now).slice(0, 8),
    recentActivity,
  };
}
