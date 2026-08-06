import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import { canCloseIncident, canTransitionCorrectiveAction, canTransitionIncident } from "@/lib/hse";

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

// `client` defaults to the top-level `db` for call sites outside a
// transaction, but MUST be passed the active `tx` when called from inside
// `db.$transaction(async (tx) => ...)` — writing through `db` there opens a
// second connection that waits on the still-open outer transaction's lock
// (SQLite serializes writers), which deadlocks until Prisma's 5s
// interactive-transaction timeout kills the outer transaction.
async function logHseActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  actorId: string | undefined,
  eventType: string,
  summary: string,
  client: Prisma.TransactionClient | typeof db = db
) {
  return client.hseActivity.create({ data: { tenantId, entityType, entityId, actorId, eventType, summary } });
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
    await logHseActivity(tenantId, "Hazard", hazard.id, identifiedById, "LOGGED", `Hazard logged: ${hazard.title}`, tx);
    return hazard;
  });
}

export async function setHazardStatus(tenantId: string, actorId: string, hazardId: string, status: string) {
  const hazard = assertTenant(await db.hazard.findUnique({ where: { id: hazardId } }), tenantId, "Hazard");
  return db.$transaction(async (tx) => {
    const updated = await tx.hazard.update({ where: { id: hazard.id }, data: { status } });
    await logHseActivity(tenantId, "Hazard", hazard.id, actorId, "STATUS_CHANGED", `Hazard status set to ${status}`, tx);
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
    await logHseActivity(tenantId, "RiskAssessment", ra.id, createdById, "CREATED", `Risk assessment drafted: ${ra.title}`, tx);
    return ra;
  });
}

export async function approveRiskAssessment(tenantId: string, approvedById: string, riskAssessmentId: string) {
  const ra = assertTenant(await db.riskAssessment.findUnique({ where: { id: riskAssessmentId } }), tenantId, "RiskAssessment");
  return db.$transaction(async (tx) => {
    const updated = await tx.riskAssessment.update({ where: { id: ra.id }, data: { status: "APPROVED", approvedById } });
    await logHseActivity(tenantId, "RiskAssessment", ra.id, approvedById, "APPROVED", "Risk assessment approved", tx);
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
    await logHseActivity(tenantId, "PermitToWork", permit.id, requestedById, "REQUESTED", `Permit to work requested: ${permit.permitType}`, tx);
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
    await logHseActivity(tenantId, "PermitToWork", permit.id, actorId, "STATUS_CHANGED", `Permit to work status set to ${status}`, tx);
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
    await logHseActivity(tenantId, "StopWorkOrder", order.id, issuedById, "ISSUED", `Stop work issued: ${order.reason}`, tx);
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
    await logHseActivity(tenantId, "StopWorkOrder", order.id, releasedById, "RELEASED", `Stop work released${releaseNotes ? `: ${releaseNotes}` : ""}`, tx);
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

// ---------------------------------------------------------------------------
// PRD_HSE_Module §49.1 Phase 1 rework — Inspections, Observations, Incidents,
// Corrective Actions, Inductions, Toolbox Talks, Emergency Contacts.
// ---------------------------------------------------------------------------

export async function listInspections(tenantId: string) {
  return db.hseInspection.findMany({ where: { tenantId }, include: { inspector: true, correctiveActions: true }, orderBy: { inspectedAt: "desc" } });
}

export async function createInspection(tenantId: string, inspectorId: string, input: { projectId: string; type?: string; location?: string; findings?: string; outcome?: string }) {
  const number = await allocateNumber(tenantId, "HSE_INSPECTION");
  return db.$transaction(async (tx) => {
    const inspection = await tx.hseInspection.create({ data: { tenantId, inspectorId, number, ...input } });
    await logHseActivity(tenantId, "HseInspection", inspection.id, inspectorId, "CREATED", `${number} inspection logged.`, tx);
    return inspection;
  });
}

export async function completeInspection(tenantId: string, actorId: string, inspectionId: string, outcome: string, findings?: string) {
  const inspection = assertTenant(await db.hseInspection.findUnique({ where: { id: inspectionId } }), tenantId, "HseInspection");
  return db.$transaction(async (tx) => {
    const updated = await tx.hseInspection.update({ where: { id: inspection.id }, data: { status: "COMPLETED", outcome, findings: findings ?? inspection.findings } });
    await logHseActivity(tenantId, "HseInspection", inspection.id, actorId, "COMPLETED", `${inspection.number} completed: ${outcome}.`, tx);
    return updated;
  });
}

export async function listObservations(tenantId: string) {
  return db.hseObservation.findMany({ where: { tenantId }, include: { reportedBy: true }, orderBy: { createdAt: "desc" } });
}

export async function createObservation(tenantId: string, reportedById: string, input: { projectId: string; type?: string; description: string; location?: string; severity?: string }) {
  const number = await allocateNumber(tenantId, "HSE_OBSERVATION");
  return db.$transaction(async (tx) => {
    const observation = await tx.hseObservation.create({ data: { tenantId, reportedById, number, ...input } });
    await logHseActivity(tenantId, "HseObservation", observation.id, reportedById, "REPORTED", `${number} observation reported.`, tx);
    return observation;
  });
}

export async function closeObservation(tenantId: string, actorId: string, observationId: string, actionTaken?: string) {
  const observation = assertTenant(await db.hseObservation.findUnique({ where: { id: observationId } }), tenantId, "HseObservation");
  return db.$transaction(async (tx) => {
    const updated = await tx.hseObservation.update({ where: { id: observation.id }, data: { status: actionTaken ? "ACTIONED" : "CLOSED", actionTaken: actionTaken ?? observation.actionTaken } });
    await logHseActivity(tenantId, "HseObservation", observation.id, actorId, "CLOSED", `${observation.number} closed.`, tx);
    return updated;
  });
}

export async function listIncidents(tenantId: string) {
  return db.hseIncident.findMany({ where: { tenantId }, include: { reportedBy: true, investigator: true, correctiveActions: true }, orderBy: { occurredAt: "desc" } });
}

export async function getIncidentDetail(tenantId: string, incidentId: string) {
  const incident = assertTenant(
    await db.hseIncident.findUnique({ where: { id: incidentId }, include: { reportedBy: true, investigator: true, correctiveActions: { include: { owner: true, verifiedBy: true } } } }),
    tenantId,
    "HseIncident"
  );
  const activity = await db.hseActivity.findMany({ where: { tenantId, entityType: "HseIncident", entityId: incidentId }, include: { actor: true }, orderBy: { createdAt: "desc" } });
  return { incident, activity };
}

export async function createIncident(tenantId: string, reportedById: string, input: { projectId: string; classification?: string; title: string; description: string; occurredAt: Date; location?: string; injuredPersonRef?: string }) {
  const number = await allocateNumber(tenantId, "HSE_INCIDENT");
  return db.$transaction(async (tx) => {
    const incident = await tx.hseIncident.create({ data: { tenantId, reportedById, number, ...input } });
    await logHseActivity(tenantId, "HseIncident", incident.id, reportedById, "REPORTED", `${number} reported: ${incident.title}.`, tx);
    return incident;
  });
}

// Governed transition — closure is blocked while any corrective action tied
// to the incident is still open (lib/hse.ts canCloseIncident), matching the
// PRD's "governed records" rule rather than trusting the caller.
export async function transitionIncident(tenantId: string, actorId: string, incidentId: string, nextStatus: string, input?: { investigatorId?: string; rootCause?: string }) {
  const incident = assertTenant(await db.hseIncident.findUnique({ where: { id: incidentId }, include: { correctiveActions: true } }), tenantId, "HseIncident");
  if (!canTransitionIncident(incident.status, nextStatus)) throw new Error(`Cannot move an incident from ${incident.status} to ${nextStatus}.`);
  if (nextStatus === "CLOSED") {
    const openActions = incident.correctiveActions.filter((a) => a.status !== "COMPLETED").length;
    if (!canCloseIncident(openActions)) throw new Error("This incident still has open corrective actions and cannot be closed.");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.hseIncident.update({
      where: { id: incident.id },
      data: { status: nextStatus, investigatorId: input?.investigatorId ?? incident.investigatorId, rootCause: input?.rootCause ?? incident.rootCause, closedAt: nextStatus === "CLOSED" ? new Date() : incident.closedAt },
    });
    await logHseActivity(tenantId, "HseIncident", incident.id, actorId, "STATUS_CHANGED", `${incident.number} moved to ${nextStatus}.`, tx);
    return updated;
  });
}

export async function createCorrectiveAction(tenantId: string, actorId: string, input: { incidentId?: string; inspectionId?: string; description: string; ownerId: string; dueDate?: Date }) {
  if (!input.incidentId && !input.inspectionId) throw new Error("A corrective action needs a parent incident or inspection.");
  if (input.incidentId) assertTenant(await db.hseIncident.findUnique({ where: { id: input.incidentId } }), tenantId, "HseIncident");
  if (input.inspectionId) assertTenant(await db.hseInspection.findUnique({ where: { id: input.inspectionId } }), tenantId, "HseInspection");
  return db.$transaction(async (tx) => {
    const action = await tx.hseCorrectiveAction.create({ data: { tenantId, ...input } });
    await logHseActivity(tenantId, "HseCorrectiveAction", action.id, actorId, "CREATED", `Corrective action raised: ${action.description}`, tx);
    return action;
  });
}

export async function transitionCorrectiveAction(tenantId: string, actorId: string, actionId: string, nextStatus: string, verifiedById?: string) {
  const action = assertTenant(await db.hseCorrectiveAction.findUnique({ where: { id: actionId } }), tenantId, "HseCorrectiveAction");
  if (!canTransitionCorrectiveAction(action.status, nextStatus)) throw new Error(`Cannot move a corrective action from ${action.status} to ${nextStatus}.`);
  return db.$transaction(async (tx) => {
    const updated = await tx.hseCorrectiveAction.update({ where: { id: action.id }, data: { status: nextStatus, completedAt: nextStatus === "COMPLETED" ? new Date() : action.completedAt, verifiedById: verifiedById ?? action.verifiedById } });
    await logHseActivity(tenantId, "HseCorrectiveAction", action.id, actorId, "STATUS_CHANGED", `Corrective action moved to ${nextStatus}.`, tx);
    return updated;
  });
}

export async function listInductions(tenantId: string) {
  return db.hseInduction.findMany({ where: { tenantId }, include: { conductedBy: true }, orderBy: { conductedAt: "desc" } });
}

export async function createInduction(tenantId: string, conductedById: string, input: { projectId: string; workerName: string; workerCompany?: string; topicsCovered?: string; expiresAt?: Date }) {
  return db.$transaction(async (tx) => {
    const induction = await tx.hseInduction.create({ data: { tenantId, conductedById, ...input } });
    await logHseActivity(tenantId, "HseInduction", induction.id, conductedById, "CONDUCTED", `Induction recorded for ${induction.workerName}.`, tx);
    return induction;
  });
}

export async function listToolboxTalks(tenantId: string) {
  return db.hseToolboxTalk.findMany({ where: { tenantId }, include: { conductedBy: true }, orderBy: { conductedAt: "desc" } });
}

export async function createToolboxTalk(tenantId: string, conductedById: string, input: { projectId: string; topic: string; notes?: string; attendeeCount?: number }) {
  return db.$transaction(async (tx) => {
    const talk = await tx.hseToolboxTalk.create({ data: { tenantId, conductedById, ...input } });
    await logHseActivity(tenantId, "HseToolboxTalk", talk.id, conductedById, "CONDUCTED", `Toolbox talk recorded: ${talk.topic}.`, tx);
    return talk;
  });
}

export async function listEmergencyContacts(tenantId: string) {
  return db.hseEmergencyContact.findMany({ where: { tenantId }, orderBy: [{ isPrimary: "desc" }, { type: "asc" }] });
}

export async function addEmergencyContact(tenantId: string, actorId: string, input: { projectId: string; name: string; role?: string; phone: string; type?: string; isPrimary?: boolean }) {
  return db.$transaction(async (tx) => {
    const contact = await tx.hseEmergencyContact.create({ data: { tenantId, ...input } });
    await logHseActivity(tenantId, "HseEmergencyContact", contact.id, actorId, "ADDED", `Emergency contact added: ${contact.name}.`, tx);
    return contact;
  });
}

export async function listTenantUsersForPicker(tenantId: string) {
  const memberships = await db.companyMembership.findMany({ where: { tenantId, accessMode: { not: "SUSPENDED" } }, include: { user: { select: { id: true, displayName: true } } }, distinct: ["userId"], orderBy: { user: { displayName: "asc" } } });
  return memberships.map((m) => m.user);
}

export async function listProjectsForPicker(tenantId: string) {
  return db.project.findMany({ where: { tenantId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
}

export async function getHseDashboardData(tenantId: string) {
  const [hazards, permitsToWork, stopWorkOrders, openIncidents, openObservations, openActions] = await Promise.all([
    db.hazard.count({ where: { tenantId, status: "OPEN" } }),
    db.permitToWork.count({ where: { tenantId, status: "ACTIVE" } }),
    db.stopWorkOrder.count({ where: { tenantId, status: "ACTIVE" } }),
    db.hseIncident.count({ where: { tenantId, status: { not: "CLOSED" } } }),
    db.hseObservation.count({ where: { tenantId, status: "OPEN" } }),
    db.hseCorrectiveAction.count({ where: { tenantId, status: { not: "COMPLETED" } } }),
  ]);
  return { openHazards: hazards, activePermits: permitsToWork, activeStopWork: stopWorkOrders, openIncidents, openObservations, openActions };
}
