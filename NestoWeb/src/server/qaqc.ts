import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import { toPaginatedResult, type PageParams } from "@/lib/pagination";

// PRD_Engineer_Dashboard §20 — a genuine, minimal QA/QC Inspection module.
// This is the single source of truth both the Engineer and (future) QA/QC
// role dashboards must defer to; nobody else may maintain a second
// inspection state (§20 "Source-of-truth boundary").

const LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  requester: { select: { id: true, displayName: true } },
  inspector: { select: { id: true, displayName: true } },
} as const;

type QaqcFilter = { projectId?: string; status?: string | string[] };

// Phase 4 — one where-builder per list, shared by the unbounded reader and its
// paginated sibling. A count() built from a second, hand-copied where clause is
// the classic way a paginated list ends up claiming a total it doesn't have.
function inspectionRequestWhere(tenantId: string, filter?: QaqcFilter) {
  return {
    tenantId,
    projectId: filter?.projectId,
    ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}),
  };
}

export async function listInspectionRequests(tenantId: string, filter?: QaqcFilter) {
  return db.inspectionRequest.findMany({
    where: inspectionRequestWhere(tenantId, filter),
    orderBy: { createdAt: "desc" },
    include: LIST_INCLUDE,
  });
}

/** Paginated sibling — Phase 4 Priority 2. */
export async function listInspectionRequestsPage(tenantId: string, params: PageParams, filter?: QaqcFilter) {
  const where = inspectionRequestWhere(tenantId, filter);
  const [items, total] = await Promise.all([
    db.inspectionRequest.findMany({ where, orderBy: { createdAt: "desc" }, include: LIST_INCLUDE, skip: params.skip, take: params.take }),
    db.inspectionRequest.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function getInspectionRequest(tenantId: string, id: string) {
  return assertTenant(await db.inspectionRequest.findUnique({ where: { id }, include: LIST_INCLUDE } ), tenantId, "InspectionRequest");
}

export async function createInspectionRequest(
  tenantId: string,
  actorId: string,
  input: {
    projectId: string;
    workPackage?: string;
    discipline?: string;
    inspectionType?: string;
    location?: string;
    quantity?: string;
    requestedDate?: Date;
    plannedDate?: Date;
    inspectorId?: string;
  }
) {
  const number = await allocateNumber(tenantId, "INSPECTION_REQUEST");
  return db.inspectionRequest.create({
    data: { tenantId, requesterId: actorId, number, ...input, status: input.plannedDate ? "SCHEDULED" : "REQUESTED" },
  });
}

export async function scheduleInspection(tenantId: string, input: { id: string; plannedDate: Date; inspectorId: string }) {
  assertTenant(await db.inspectionRequest.findUnique({ where: { id: input.id } }), tenantId, "InspectionRequest");
  return db.inspectionRequest.update({
    where: { id: input.id },
    data: { plannedDate: input.plannedDate, inspectorId: input.inspectorId, status: "SCHEDULED" },
  });
}

export async function markInspectionReady(tenantId: string, id: string) {
  assertTenant(await db.inspectionRequest.findUnique({ where: { id } }), tenantId, "InspectionRequest");
  return db.inspectionRequest.update({ where: { id }, data: { status: "READY" } });
}

export async function startInspection(tenantId: string, id: string) {
  assertTenant(await db.inspectionRequest.findUnique({ where: { id } }), tenantId, "InspectionRequest");
  return db.inspectionRequest.update({ where: { id }, data: { status: "IN_INSPECTION" } });
}

// §20.1 "A result cannot be rewritten from Fail to Pass without reinspection
// or an authorized superseding process" — a FAIL/REINSPECTION_REQUIRED
// result can only be followed by a new inspection (fresh execute->result
// cycle from IN_INSPECTION), never a direct status edit on the same record.
const RESULT_TO_STATUS: Record<string, string> = {
  PASS: "RESULT_ISSUED",
  PASS_WITH_COMMENTS: "RESULT_ISSUED",
  CONDITIONAL_ACCEPTANCE: "RESULT_ISSUED",
  PARTIAL_PASS: "RESULT_ISSUED",
  FAIL: "REINSPECTION_REQUIRED",
};

export async function issueInspectionResult(
  tenantId: string,
  actorId: string,
  input: { id: string; result: string; evidenceNotes?: string }
) {
  const inspection = assertTenant(await db.inspectionRequest.findUnique({ where: { id: input.id } }), tenantId, "InspectionRequest");
  if (inspection.status !== "IN_INSPECTION") {
    // Covers RESULT_ISSUED and REINSPECTION_REQUIRED alike — a result can
    // only be issued from an active execute phase, never overwritten in
    // place (§20.1 "cannot be rewritten from Fail to Pass without
    // reinspection"). reopenForReinspection() is the only door back in.
    throw new Error("This inspection is not in an active execute phase. Start (or reopen) it before issuing a result.");
  }
  const status = RESULT_TO_STATUS[input.result];
  if (!status) throw new Error("Unknown inspection result.");
  return db.inspectionRequest.update({
    where: { id: input.id },
    data: { status, result: input.result, resultAt: new Date(), resultById: actorId, evidenceNotes: input.evidenceNotes },
  });
}

/** §20.1 "cannot be rewritten... without reinspection" — this reopens the
 * SAME request for a new execute->result cycle (fresh row would lose the
 * failed-history link); prior result/evidence stay on record via history,
 * not overwritten in place until a new result is issued. */
export async function reopenForReinspection(tenantId: string, id: string) {
  const inspection = assertTenant(await db.inspectionRequest.findUnique({ where: { id } }), tenantId, "InspectionRequest");
  if (inspection.status !== "REINSPECTION_REQUIRED") throw new Error("Only a failed inspection awaiting reinspection can be reopened.");
  return db.inspectionRequest.update({ where: { id }, data: { status: "SCHEDULED" } });
}

export async function linkCorrectiveTask(tenantId: string, input: { id: string; taskId: string }) {
  assertTenant(await db.inspectionRequest.findUnique({ where: { id: input.id } }), tenantId, "InspectionRequest");
  return db.inspectionRequest.update({ where: { id: input.id }, data: { correctiveTaskId: input.taskId } });
}

async function logQaqcActivity(input: { tenantId: string; entityType: string; entityId: string; actorId?: string | null; eventType: string; summary: string }) {
  await db.qaqcActivity.create({
    data: { tenantId: input.tenantId, entityType: input.entityType, entityId: input.entityId, actorId: input.actorId ?? null, eventType: input.eventType, summary: input.summary },
  });
}

// ---------------------------------------------------------------------------
// PRD_QAQC_Dashboard §11 — NCR Control. Canonical lifecycle Draft -> Issued
// -> Containment -> Root Cause -> Corrective Plan -> Implementation ->
// Verification -> Closed. "Closed NCRs cannot be edited or deleted in
// place" — reopenNcr() is the only door back in, same reopen-not-rewrite
// pattern as reopenForReinspection() above.
// ---------------------------------------------------------------------------

const NCR_STAGE_ORDER = ["DRAFT", "ISSUED", "CONTAINMENT", "ROOT_CAUSE", "CORRECTIVE_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"] as const;

const NCR_LIST_INCLUDE = { project: { select: { id: true, name: true } }, raisedBy: { select: { id: true, displayName: true } } } as const;

function ncrWhere(tenantId: string, filter?: QaqcFilter) {
  return { tenantId, projectId: filter?.projectId, ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}) };
}

export async function listNcrs(tenantId: string, filter?: QaqcFilter) {
  return db.ncr.findMany({ where: ncrWhere(tenantId, filter), orderBy: { createdAt: "desc" }, include: NCR_LIST_INCLUDE });
}

/** Paginated sibling — Phase 4 Priority 2. No route reads this yet; the NCR register is still unbuilt. */
export async function listNcrsPage(tenantId: string, params: PageParams, filter?: QaqcFilter) {
  const where = ncrWhere(tenantId, filter);
  const [items, total] = await Promise.all([
    db.ncr.findMany({ where, orderBy: { createdAt: "desc" }, include: NCR_LIST_INCLUDE, skip: params.skip, take: params.take }),
    db.ncr.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function getNcrDetail(tenantId: string, id: string) {
  const ncr = assertTenant(
    await db.ncr.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } }, raisedBy: { select: { id: true, displayName: true } }, verifiedBy: { select: { id: true, displayName: true } }, inspectionRequest: { select: { id: true, number: true } } },
    }),
    tenantId,
    "Ncr"
  );
  const activity = await db.qaqcActivity.findMany({ where: { tenantId, entityType: "Ncr", entityId: id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, displayName: true } } } });
  return { ...ncr, activity };
}

export async function createNcr(
  tenantId: string,
  actorId: string,
  input: { projectId: string; description: string; requirement?: string; discipline?: string; location?: string; severity?: string; inspectionRequestId?: string; dueDate?: Date }
) {
  const number = await allocateNumber(tenantId, "NCR");
  const ncr = await db.ncr.create({ data: { tenantId, number, raisedById: actorId, status: "ISSUED", severity: input.severity ?? "MEDIUM", ...input } });
  await logQaqcActivity({ tenantId, entityType: "Ncr", entityId: ncr.id, actorId, eventType: "ISSUED", summary: `${number} issued` });
  return ncr;
}

/** Advances one governed stage at a time — a stage cannot be skipped and a
 * Closed NCR cannot be edited (§11.2). */
export async function advanceNcrStage(tenantId: string, actorId: string, input: { id: string; nextStage: (typeof NCR_STAGE_ORDER)[number]; note?: string }) {
  const ncr = assertTenant(await db.ncr.findUnique({ where: { id: input.id } }), tenantId, "Ncr");
  if (ncr.status === "CLOSED") throw new Error("A closed NCR cannot be edited in place. Reopen it first.");
  const currentIndex = NCR_STAGE_ORDER.indexOf(ncr.status as (typeof NCR_STAGE_ORDER)[number]);
  const nextIndex = NCR_STAGE_ORDER.indexOf(input.nextStage);
  if (nextIndex !== currentIndex + 1) throw new Error(`An NCR at ${ncr.status} can only advance to ${NCR_STAGE_ORDER[currentIndex + 1] ?? "no further stage"}.`);

  const data: Record<string, unknown> = { status: input.nextStage };
  if (input.nextStage === "CONTAINMENT") data.containmentAction = input.note;
  if (input.nextStage === "ROOT_CAUSE") data.rootCause = input.note;
  if (input.nextStage === "CORRECTIVE_PLAN") data.correctiveActionPlan = input.note;
  if (input.nextStage === "VERIFICATION") { data.verifiedById = actorId; data.verifiedAt = new Date(); }
  if (input.nextStage === "CLOSED") data.closedAt = new Date();

  const updated = await db.ncr.update({ where: { id: input.id }, data });
  await logQaqcActivity({ tenantId, entityType: "Ncr", entityId: input.id, actorId, eventType: input.nextStage, summary: `${ncr.number} moved to ${input.nextStage}${input.note ? `: ${input.note}` : ""}` });
  return updated;
}

export async function reopenNcr(tenantId: string, actorId: string, id: string, reason: string) {
  const ncr = assertTenant(await db.ncr.findUnique({ where: { id } }), tenantId, "Ncr");
  if (ncr.status !== "CLOSED") throw new Error("Only a closed NCR can be reopened.");
  if (!reason.trim()) throw new Error("A reopen reason is required.");
  const updated = await db.ncr.update({ where: { id }, data: { status: "REOPENED" } });
  await logQaqcActivity({ tenantId, entityType: "Ncr", entityId: id, actorId, eventType: "REOPENED", summary: `${ncr.number} reopened: ${reason.trim()}` });
  return updated;
}

// ---------------------------------------------------------------------------
// PRD_QAQC_Dashboard §13 — Defects/Snags/Punch. Shared lifecycle: Open ->
// Assigned -> In Correction -> Ready for Review -> Verified -> Closed.
// "Verification rejection returns the issue to a governed correction state
// without deleting prior evidence" — rejectDefectVerification() does that.
// ---------------------------------------------------------------------------

type DefectFilter = QaqcFilter & { type?: string };

const DEFECT_LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, displayName: true } },
  raisedBy: { select: { id: true, displayName: true } },
} as const;

function defectWhere(tenantId: string, filter?: DefectFilter) {
  return { tenantId, projectId: filter?.projectId, type: filter?.type, ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}) };
}

export async function listDefects(tenantId: string, filter?: DefectFilter) {
  return db.defect.findMany({ where: defectWhere(tenantId, filter), orderBy: { createdAt: "desc" }, include: DEFECT_LIST_INCLUDE });
}

/** Paginated sibling — Phase 4 Priority 2. No route reads this yet; the defect register is still unbuilt. */
export async function listDefectsPage(tenantId: string, params: PageParams, filter?: DefectFilter) {
  const where = defectWhere(tenantId, filter);
  const [items, total] = await Promise.all([
    db.defect.findMany({ where, orderBy: { createdAt: "desc" }, include: DEFECT_LIST_INCLUDE, skip: params.skip, take: params.take }),
    db.defect.count({ where }),
  ]);
  return toPaginatedResult(items, total, params);
}

export async function getDefectDetail(tenantId: string, id: string) {
  const defect = assertTenant(
    await db.defect.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } }, assignedTo: { select: { id: true, displayName: true } }, raisedBy: { select: { id: true, displayName: true } }, verifiedBy: { select: { id: true, displayName: true } } },
    }),
    tenantId,
    "Defect"
  );
  const activity = await db.qaqcActivity.findMany({ where: { tenantId, entityType: "Defect", entityId: id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, displayName: true } } } });
  return { ...defect, activity };
}

export async function createDefect(
  tenantId: string,
  actorId: string,
  input: { projectId: string; type?: string; description: string; location?: string; severity?: string; assignedToId?: string }
) {
  const number = await allocateNumber(tenantId, "DEFECT");
  const defect = await db.defect.create({ data: { tenantId, number, raisedById: actorId, type: input.type ?? "DEFECT", severity: input.severity ?? "MEDIUM", status: input.assignedToId ? "ASSIGNED" : "OPEN", ...input } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: defect.id, actorId, eventType: "CREATED", summary: `${number} created` });
  return defect;
}

export async function assignDefect(tenantId: string, actorId: string, id: string, assignedToId: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status === "CLOSED") throw new Error("A closed defect cannot be reassigned.");
  const updated = await db.defect.update({ where: { id }, data: { assignedToId, status: "ASSIGNED" } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "ASSIGNED", summary: `${defect.number} assigned` });
  return updated;
}

export async function markDefectInCorrection(tenantId: string, actorId: string, id: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "ASSIGNED" && defect.status !== "REOPENED") throw new Error("Only an assigned or reopened defect can move to In Correction.");
  const updated = await db.defect.update({ where: { id }, data: { status: "IN_CORRECTION" } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "IN_CORRECTION", summary: `${defect.number} in correction` });
  return updated;
}

export async function submitDefectForReview(tenantId: string, actorId: string, id: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "IN_CORRECTION") throw new Error("Only a defect in correction can be submitted for review.");
  const updated = await db.defect.update({ where: { id }, data: { status: "READY_FOR_REVIEW" } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "READY_FOR_REVIEW", summary: `${defect.number} ready for verification` });
  return updated;
}

/** §13.2 "Reinspection links the original failure/issue to the new attempt;
 * it does not erase the original result" — verifying closes the item,
 * rejecting returns it to In Correction preserving the rejection reason. */
export async function verifyDefect(tenantId: string, actorId: string, id: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "READY_FOR_REVIEW") throw new Error("Only a defect ready for review can be verified.");
  const updated = await db.defect.update({ where: { id }, data: { status: "VERIFIED", verifiedById: actorId, verifiedAt: new Date(), rejectionReason: null } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "VERIFIED", summary: `${defect.number} verified` });
  return updated;
}

export async function rejectDefectVerification(tenantId: string, actorId: string, id: string, reason: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "READY_FOR_REVIEW") throw new Error("Only a defect ready for review can be rejected.");
  if (!reason.trim()) throw new Error("A rejection reason is required.");
  const updated = await db.defect.update({ where: { id }, data: { status: "IN_CORRECTION", rejectionReason: reason.trim() } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "VERIFICATION_REJECTED", summary: `${defect.number} rejected: ${reason.trim()}` });
  return updated;
}

export async function closeDefect(tenantId: string, actorId: string, id: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "VERIFIED") throw new Error("Only a verified defect can be closed.");
  const updated = await db.defect.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "CLOSED", summary: `${defect.number} closed` });
  // Phase 1 Track B — QA/QC sign-off had no AuditEvent; closing a defect is
  // the assertion that the work is acceptable.
  await logAudit({ tenantId, actorId, action: "qaqc.defect.closed", targetType: "Defect", targetId: id,
    metadata: { number: defect.number, projectId: defect.projectId } });
  return updated;
}

export async function reopenDefect(tenantId: string, actorId: string, id: string, reason: string) {
  const defect = assertTenant(await db.defect.findUnique({ where: { id } }), tenantId, "Defect");
  if (defect.status !== "CLOSED") throw new Error("Only a closed defect can be reopened.");
  const updated = await db.defect.update({ where: { id }, data: { status: "REOPENED" } });
  await logQaqcActivity({ tenantId, entityType: "Defect", entityId: id, actorId, eventType: "REOPENED", summary: `${defect.number} reopened: ${reason}` });
  return updated;
}

// ---------------------------------------------------------------------------
// PRD_QAQC_Dashboard §14 — Quality Gates. "Gate state is calculated by the
// backend from authoritative requirement states" — computed on read, never
// stored, so it can never drift from the NCR/Defect/Inspection records that
// feed it. A gate is BLOCKING whenever a project has any Critical-severity
// open NCR, any Critical/High open Defect, or any inspection awaiting
// reinspection.
// ---------------------------------------------------------------------------

export async function getQualityGates(tenantId: string, projectId?: string) {
  const [criticalNcrs, blockingDefects, reinspections] = await Promise.all([
    db.ncr.findMany({ where: { tenantId, projectId, severity: "CRITICAL", status: { notIn: ["CLOSED"] } }, include: { project: { select: { id: true, name: true } } } }),
    db.defect.findMany({ where: { tenantId, projectId, severity: { in: ["CRITICAL", "HIGH"] }, status: { notIn: ["CLOSED"] } }, include: { project: { select: { id: true, name: true } } } }),
    db.inspectionRequest.findMany({ where: { tenantId, projectId, status: "REINSPECTION_REQUIRED" }, include: { project: { select: { id: true, name: true } } } }),
  ]);

  const byProject = new Map<string, { projectId: string; projectName: string; blockingNcrs: number; blockingDefects: number; blockingReinspections: number }>();
  function bump(pid: string, pname: string, key: "blockingNcrs" | "blockingDefects" | "blockingReinspections") {
    const existing = byProject.get(pid) ?? { projectId: pid, projectName: pname, blockingNcrs: 0, blockingDefects: 0, blockingReinspections: 0 };
    existing[key] += 1;
    byProject.set(pid, existing);
  }
  for (const n of criticalNcrs) bump(n.projectId, n.project.name, "blockingNcrs");
  for (const d of blockingDefects) bump(d.projectId, d.project.name, "blockingDefects");
  for (const r of reinspections) bump(r.projectId, r.project.name, "blockingReinspections");

  return Array.from(byProject.values()).map((g) => ({ ...g, blocking: g.blockingNcrs + g.blockingDefects + g.blockingReinspections > 0 }));
}
