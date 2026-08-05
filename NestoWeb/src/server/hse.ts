import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

export async function listHseReports(tenantId: string) {
  return db.hseReport.findMany({
    where: { tenantId },
    include: { project: true, reportedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createHseReport(
  tenantId: string,
  reportedById: string,
  input: { projectId: string; title: string; description: string; severity?: string }
) {
  return db.hseReport.create({ data: { tenantId, reportedById, ...input } });
}

export async function updateHseReportStatus(tenantId: string, reportId: string, status: string) {
  const report = assertTenant(await db.hseReport.findUnique({ where: { id: reportId } }), tenantId, "HseReport");
  return db.hseReport.update({ where: { id: report.id }, data: { status } });
}

// ---------------------------------------------------------------------------
// PRD_HSE_Module — Phase 1 (hazards, risk assessments, permits to work,
// stop-work). Additive alongside HseReport above. Projects module is FROZEN
// (projects_module_frozen): projectId is a plain scalar reference throughout,
// never a Prisma relation — nothing here touches the Project model.
// ---------------------------------------------------------------------------

async function logHseActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  actorId: string | undefined,
  eventType: string,
  summary: string
) {
  return db.hseActivity.create({ data: { tenantId, entityType, entityId, actorId, eventType, summary } });
}

export async function listHazards(tenantId: string) {
  return db.hazard.findMany({ where: { tenantId }, include: { identifiedBy: true }, orderBy: { createdAt: "desc" } });
}

export async function listHazardsForProject(tenantId: string, projectId: string) {
  return db.hazard.findMany({ where: { tenantId, projectId }, orderBy: { createdAt: "desc" } });
}

// Hierarchy of Controls is a required field on every hazard, not an
// afterthought — the PRD's critical rule is that the system must never
// default to PPE when a stronger control is available, so callers always
// have to state which level was actually applied.
export async function createHazard(
  tenantId: string,
  identifiedById: string,
  input: {
    projectId: string;
    title: string;
    description: string;
    category?: string;
    likelihood?: string;
    severity?: string;
    controlLevel?: string;
    controlNotes?: string;
  }
) {
  return db.$transaction(async (tx) => {
    const hazard = await tx.hazard.create({ data: { tenantId, identifiedById, ...input } });
    await logHseActivity(tenantId, "Hazard", hazard.id, identifiedById, "LOGGED", `Hazard logged: ${hazard.title}`);
    return hazard;
  });
}

export async function setHazardStatus(tenantId: string, actorId: string, hazardId: string, status: string) {
  const hazard = assertTenant(await db.hazard.findUnique({ where: { id: hazardId } }), tenantId, "Hazard");
  return db.$transaction(async (tx) => {
    const updated = await tx.hazard.update({ where: { id: hazard.id }, data: { status } });
    await logHseActivity(tenantId, "Hazard", hazard.id, actorId, "STATUS_CHANGED", `Hazard status set to ${status}`);
    return updated;
  });
}

export async function listRiskAssessmentsForProject(tenantId: string, projectId: string) {
  return db.riskAssessment.findMany({
    where: { tenantId, projectId },
    include: { hazard: true, createdBy: true, approvedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRiskAssessment(
  tenantId: string,
  createdById: string,
  input: { projectId: string; hazardId?: string; title: string; validFrom?: Date; validTo?: Date }
) {
  return db.$transaction(async (tx) => {
    const ra = await tx.riskAssessment.create({ data: { tenantId, createdById, ...input } });
    await logHseActivity(tenantId, "RiskAssessment", ra.id, createdById, "CREATED", `Risk assessment drafted: ${ra.title}`);
    return ra;
  });
}

export async function approveRiskAssessment(tenantId: string, approvedById: string, riskAssessmentId: string) {
  const ra = assertTenant(await db.riskAssessment.findUnique({ where: { id: riskAssessmentId } }), tenantId, "RiskAssessment");
  return db.$transaction(async (tx) => {
    const updated = await tx.riskAssessment.update({ where: { id: ra.id }, data: { status: "APPROVED", approvedById } });
    await logHseActivity(tenantId, "RiskAssessment", ra.id, approvedById, "APPROVED", "Risk assessment approved");
    return updated;
  });
}

export async function listPermitsToWork(tenantId: string) {
  return db.permitToWork.findMany({ where: { tenantId }, include: { requestedBy: true, issuedBy: true }, orderBy: { createdAt: "desc" } });
}

export async function getPermitToWorkDetail(tenantId: string, permitId: string) {
  const permit = await db.permitToWork.findUnique({ where: { id: permitId }, include: { requestedBy: true, issuedBy: true } });
  if (!permit || permit.tenantId !== tenantId) return null;
  const activity = await db.hseActivity.findMany({
    where: { tenantId, entityType: "PermitToWork", entityId: permitId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });
  return { permit, activity };
}

export async function requestPermitToWork(
  tenantId: string,
  requestedById: string,
  input: { projectId: string; permitType: string; description?: string; validFrom?: Date; validTo?: Date }
) {
  return db.$transaction(async (tx) => {
    const permit = await tx.permitToWork.create({ data: { tenantId, requestedById, ...input } });
    await logHseActivity(tenantId, "PermitToWork", permit.id, requestedById, "REQUESTED", `Permit to work requested: ${permit.permitType}`);
    return permit;
  });
}

// Activation is server-authoritative — only this function may set a permit
// ACTIVE, and it always stamps issuedById; a client can never fake activation
// by posting a status string directly (the client only ever calls this).
export async function setPermitToWorkStatus(tenantId: string, actorId: string, permitId: string, status: string) {
  const permit = assertTenant(await db.permitToWork.findUnique({ where: { id: permitId } }), tenantId, "PermitToWork");
  return db.$transaction(async (tx) => {
    const updated = await tx.permitToWork.update({
      where: { id: permit.id },
      data: { status, ...(status === "ACTIVE" ? { issuedById: actorId } : {}) },
    });
    await logHseActivity(tenantId, "PermitToWork", permit.id, actorId, "STATUS_CHANGED", `Permit to work status set to ${status}`);
    return updated;
  });
}

export async function listStopWorkOrders(tenantId: string) {
  return db.stopWorkOrder.findMany({ where: { tenantId }, include: { issuedBy: true, releasedBy: true }, orderBy: { issuedAt: "desc" } });
}

// Fast-issue path — no approval gate on raising a stop-work order (anyone
// empowered can stop work immediately, per the PRD). Release is the
// controlled half: it always stamps who released it and why, and can never
// happen silently.
export async function issueStopWorkOrder(
  tenantId: string,
  issuedById: string,
  input: { projectId: string; scopeType: string; scopeRef?: string; reason: string }
) {
  return db.$transaction(async (tx) => {
    const order = await tx.stopWorkOrder.create({ data: { tenantId, issuedById, ...input } });
    await logHseActivity(tenantId, "StopWorkOrder", order.id, issuedById, "ISSUED", `Stop work issued: ${order.reason}`);
    return order;
  });
}

export async function releaseStopWorkOrder(tenantId: string, releasedById: string, orderId: string, releaseNotes?: string) {
  const order = assertTenant(await db.stopWorkOrder.findUnique({ where: { id: orderId } }), tenantId, "StopWorkOrder");
  if (order.status !== "ACTIVE") throw new Error("Only an active stop-work order can be released.");
  return db.$transaction(async (tx) => {
    const updated = await tx.stopWorkOrder.update({
      where: { id: order.id },
      data: { status: "RELEASED", releasedById, releasedAt: new Date(), releaseNotes },
    });
    await logHseActivity(tenantId, "StopWorkOrder", order.id, releasedById, "RELEASED", `Stop work released${releaseNotes ? `: ${releaseNotes}` : ""}`);
    return updated;
  });
}

export type WorkStartGate = "READY" | "RESTRICTED" | "BLOCKED" | "UNKNOWN";

// Phase 1 heuristic for the PRD's "work-start safety gate" — a simplified,
// read-only computation (no Work Progress integration yet, since that module
// isn't built): BLOCKED if any stop-work order is active on the project;
// RESTRICTED if an open, uncontrolled hazard exists; UNKNOWN if no risk
// assessment has ever been approved; READY otherwise. The full engine
// (permit/competence/asset checks) is later work.
export async function getWorkStartGate(tenantId: string, projectId: string): Promise<{ status: WorkStartGate; reason: string }> {
  const [activeStopWork, openHazard, approvedRiskAssessment] = await Promise.all([
    db.stopWorkOrder.findFirst({ where: { tenantId, projectId, status: "ACTIVE" } }),
    db.hazard.findFirst({ where: { tenantId, projectId, status: "OPEN" } }),
    db.riskAssessment.findFirst({ where: { tenantId, projectId, status: "APPROVED" } }),
  ]);

  if (activeStopWork) return { status: "BLOCKED", reason: `Active stop-work order: ${activeStopWork.reason}` };
  if (openHazard) return { status: "RESTRICTED", reason: `Uncontrolled open hazard: ${openHazard.title}` };
  if (!approvedRiskAssessment) return { status: "UNKNOWN", reason: "No approved risk assessment on file for this project." };
  return { status: "READY", reason: "No active stop-work orders, no open hazards, risk assessment on file." };
}

export async function listProjectsForPicker(tenantId: string) {
  return db.project.findMany({ where: { tenantId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
}

export async function getHseDashboardData(tenantId: string) {
  const [hazards, permitsToWork, stopWorkOrders] = await Promise.all([
    db.hazard.count({ where: { tenantId, status: "OPEN" } }),
    db.permitToWork.count({ where: { tenantId, status: "ACTIVE" } }),
    db.stopWorkOrder.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);
  return { openHazards: hazards, activePermits: permitsToWork, activeStopWork: stopWorkOrders };
}
