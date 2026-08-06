import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { allocateNumber } from "@/server/number-series";
import { assertTenant, requireTenantProject } from "@/lib/tenant";
import { canTransitionProgressUpdate, canTransitionWorkPackage, validateAcceptedQuantity } from "@/lib/work-progress";

async function event(tenantId: string, actorId: string, entityType: string, entityId: string, eventType: string, summary: string, projectId?: string, previousStatus?: string, nextStatus?: string) {
  return db.workProgressActivity.create({ data: { tenantId, actorId, entityType, entityId, eventType, summary, projectId, previousStatus, nextStatus, correlationId: randomUUID() } });
}

export async function getWorkProgressDashboard(tenantId: string) {
  const [packages, updates, reports, constraints, delays, activity] = await Promise.all([
    db.workPackage.findMany({ where: { tenantId, archivedAt: null }, include: { project: true }, orderBy: { updatedAt: "desc" } }),
    db.workProgressUpdate.findMany({ where: { tenantId }, orderBy: { effectiveAt: "desc" } }),
    db.dailySiteReport.findMany({ where: { tenantId }, include: { project: true }, orderBy: { reportDate: "desc" }, take: 6 }),
    db.workConstraint.findMany({ where: { tenantId, status: { notIn: ["RELEASED", "CLOSED", "CANCELLED"] } }, include: { project: true }, orderBy: { requiredBy: "asc" } }),
    db.workDelayEvent.findMany({ where: { tenantId, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.workProgressActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const approved = packages.reduce((s, p) => s + p.approvedQuantity * (p.weight || 1), 0);
  const accepted = packages.reduce((s, p) => s + p.acceptedQuantity * (p.weight || 1), 0);
  return { packages, updates, reports, constraints, delays, activity, acceptedPct: approved ? Math.min(100, accepted / approved * 100) : 0, submittedCount: updates.filter(u => ["SUBMITTED", "UNDER_VERIFICATION"].includes(u.status)).length };
}

export const listWorkPackages = (tenantId: string) => db.workPackage.findMany({ where: { tenantId, archivedAt: null }, include: { project: true, _count: { select: { updates: true, constraints: true, evidence: true } } }, orderBy: [{ projectId: "asc" }, { code: "asc" }] });
export const getWorkPackage = async (tenantId: string, id: string) => assertTenant(await db.workPackage.findUnique({ where: { id }, include: { project: true, updates: { include: { evidence: true }, orderBy: { effectiveAt: "desc" } }, activities: { orderBy: { plannedStart: "asc" } }, constraints: { orderBy: { createdAt: "desc" } }, delays: { orderBy: { createdAt: "desc" } }, evidence: { orderBy: { capturedAt: "desc" } } } }), tenantId, "WorkPackage");
export const listSchedules = (tenantId: string) => db.workScheduleVersion.findMany({ where: { tenantId }, include: { project: true, activities: { include: { workPackage: true }, orderBy: { plannedStart: "asc" } } }, orderBy: { createdAt: "desc" } });
export const listDailyReports = (tenantId: string) => db.dailySiteReport.findMany({ where: { tenantId }, include: { project: true }, orderBy: [{ reportDate: "desc" }, { revision: "desc" }] });
export const listConstraintsAndDelays = async (tenantId: string) => ({ constraints: await db.workConstraint.findMany({ where: { tenantId }, include: { project: true, workPackage: true }, orderBy: { createdAt: "desc" } }), delays: await db.workDelayEvent.findMany({ where: { tenantId }, include: { project: true, workPackage: true }, orderBy: { createdAt: "desc" } }) });
export const listEvidence = (tenantId: string) => db.workProgressEvidence.findMany({ where: { tenantId }, include: { project: true, workPackage: true }, orderBy: { capturedAt: "desc" } });
export const listMeasurementSheets = (tenantId: string) => db.workMeasurementSheet.findMany({ where: { tenantId }, include: { project: true, lines: { include: { workPackage: true } } }, orderBy: { periodEnd: "desc" } });

export async function createWorkPackage(tenantId: string, actorId: string, input: { companyId: string; projectId: string; name: string; description?: string; discipline: string; location?: string; contractorName?: string; measurementMethod: string; unit: string; approvedQuantity: number; weight?: number; plannedStart?: Date; plannedFinish?: Date }) {
  await requireTenantProject(tenantId, input.projectId); const code = await allocateNumber(tenantId, "WORK_PACKAGE");
  const row = await db.workPackage.create({ data: { tenantId, createdById: actorId, accountableOwnerId: actorId, code, ...input } });
  await event(tenantId, actorId, "WORK_PACKAGE", row.id, "work_package.created", `${code} ${row.name} created.`, row.projectId); return row;
}

export async function transitionWorkPackage(tenantId: string, actorId: string, id: string, status: string) {
  const row = assertTenant(await db.workPackage.findUnique({ where: { id } }), tenantId, "WorkPackage");
  if (!canTransitionWorkPackage(row.status, status)) throw new Error(`Cannot move ${row.status} to ${status}.`);
  await db.workPackage.update({ where: { id }, data: { status, recordVersion: { increment: 1 } } });
  await event(tenantId, actorId, "WORK_PACKAGE", id, "work_package.status_changed", `${row.code} moved to ${status}.`, row.projectId, row.status, status);
}

export async function recordProgress(tenantId: string, actorId: string, input: { workPackageId: string; quantity: number; effectiveAt: Date; location?: string; notes?: string; idempotencyKey: string }) {
  const pkg = assertTenant(await db.workPackage.findUnique({ where: { id: input.workPackageId } }), tenantId, "WorkPackage");
  const existing = await db.workProgressUpdate.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } } }); if (existing) return existing;
  validateAcceptedQuantity(pkg.acceptedQuantity, input.quantity, pkg.approvedQuantity);
  const updateNumber = await allocateNumber(tenantId, "WORK_PROGRESS_UPDATE");
  const update = await db.$transaction(async tx => { const u = await tx.workProgressUpdate.create({ data: { tenantId, projectId: pkg.projectId, workPackageId: pkg.id, idempotencyKey: input.idempotencyKey, updateNumber, method: pkg.measurementMethod, periodQuantity: input.quantity, unit: pkg.unit, effectiveAt: input.effectiveAt, location: input.location, notes: input.notes, status: "ACCEPTED", submittedAt: new Date(), verifiedAt: new Date(), acceptedAt: new Date(), createdById: actorId, verifiedById: actorId } }); await tx.workPackage.update({ where: { id: pkg.id }, data: { acceptedQuantity: { increment: input.quantity }, status: pkg.status === "READY" ? "IN_PROGRESS" : pkg.status, recordVersion: { increment: 1 } } }); return u; });
  await event(tenantId, actorId, "PROGRESS_UPDATE", update.id, "progress_update.accepted", `${input.quantity} ${pkg.unit} accepted for ${pkg.code}.`, pkg.projectId); return update;
}

export async function createDailyReport(tenantId: string, actorId: string, input: { companyId: string; projectId: string; reportDate: Date; shift: string; weather?: string; siteConditions?: string; workforceJson?: string; equipmentJson?: string; workCompleted?: string; deliveriesJson?: string; issues?: string; qualityNotes?: string; hseNotes?: string; nextShiftPlan?: string }) {
  await requireTenantProject(tenantId, input.projectId); const reportNumber = await allocateNumber(tenantId, "DAILY_SITE_REPORT");
  const row = await db.dailySiteReport.create({ data: { tenantId, createdById: actorId, accountableOwnerId: actorId, reportNumber, ...input } }); await event(tenantId, actorId, "DAILY_REPORT", row.id, "daily_report.created", `${reportNumber} created.`, row.projectId); return row;
}

export async function submitDailyReport(tenantId: string, actorId: string, id: string) { const row = assertTenant(await db.dailySiteReport.findUnique({ where: { id } }), tenantId, "DailySiteReport"); if (!['DRAFT','IN_PREPARATION','RETURNED'].includes(row.status)) throw new Error("Only an editable report can be submitted."); await db.dailySiteReport.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } }); await event(tenantId, actorId, "DAILY_REPORT", id, "daily_report.submitted", `${row.reportNumber} submitted.`, row.projectId, row.status, "SUBMITTED"); }

// PRD Work Progress §45 Phase 1 — "basic baseline": a working schedule can
// be created, populated with activities, and one version per project
// promoted to the immutable active baseline that progress is measured
// against. Only one baseline may be ACTIVE per project at a time.
export async function createScheduleVersion(tenantId: string, actorId: string, input: { companyId: string; projectId: string; name: string; dataDate: Date }) {
  await requireTenantProject(tenantId, input.projectId);
  const last = await db.workScheduleVersion.findFirst({ where: { tenantId, projectId: input.projectId }, orderBy: { version: "desc" } });
  const row = await db.workScheduleVersion.create({ data: { tenantId, createdById: actorId, version: (last?.version ?? 0) + 1, ...input } });
  await event(tenantId, actorId, "SCHEDULE_VERSION", row.id, "schedule_version.created", `${row.name} v${row.version} created.`, row.projectId); return row;
}

export async function createScheduleActivity(tenantId: string, actorId: string, input: { scheduleVersionId: string; workPackageId?: string; code: string; name: string; plannedStart: Date; plannedFinish: Date; durationDays?: number; dependencyType?: string; predecessorCode?: string; lagDays?: number; isMilestone?: boolean }) {
  const version = assertTenant(await db.workScheduleVersion.findUnique({ where: { id: input.scheduleVersionId } }), tenantId, "WorkScheduleVersion");
  if (version.status === "ACTIVE") throw new Error("Cannot add activities to an active, locked baseline.");
  const row = await db.workScheduleActivity.create({ data: { tenantId, projectId: version.projectId, ...input } });
  await event(tenantId, actorId, "SCHEDULE_ACTIVITY", row.id, "schedule_activity.created", `${row.code} ${row.name} added to ${version.name}.`, version.projectId); return row;
}

export async function activateBaseline(tenantId: string, actorId: string, scheduleVersionId: string) {
  const version = assertTenant(await db.workScheduleVersion.findUnique({ where: { id: scheduleVersionId } }), tenantId, "WorkScheduleVersion");
  if (version.status === "ACTIVE") throw new Error("This version is already the active baseline.");
  const checksum = randomUUID();
  await db.$transaction(async tx => {
    await tx.workScheduleVersion.updateMany({ where: { tenantId, projectId: version.projectId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
    await tx.workScheduleVersion.update({ where: { id: scheduleVersionId }, data: { status: "ACTIVE", type: "BASELINE", baselineAt: new Date(), checksum } });
  });
  await event(tenantId, actorId, "SCHEDULE_VERSION", scheduleVersionId, "schedule_version.baseline_activated", `${version.name} v${version.version} activated as the project baseline.`, version.projectId, version.status, "ACTIVE");
}

// Full submit/verify workflow (PRD Phase 1 "progress updates and audit").
// This coexists with the fast-path recordProgress() used for quick field
// capture: recordProgress self-accepts, this path defers rollup until an
// independent verifier accepts the claim.
export async function createProgressDraft(tenantId: string, actorId: string, input: { workPackageId: string; quantity: number; effectiveAt: Date; location?: string; notes?: string; idempotencyKey: string }) {
  const pkg = assertTenant(await db.workPackage.findUnique({ where: { id: input.workPackageId } }), tenantId, "WorkPackage");
  const existing = await db.workProgressUpdate.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } } }); if (existing) return existing;
  validateAcceptedQuantity(pkg.acceptedQuantity, input.quantity, pkg.approvedQuantity);
  const updateNumber = await allocateNumber(tenantId, "WORK_PROGRESS_UPDATE");
  const row = await db.workProgressUpdate.create({ data: { tenantId, projectId: pkg.projectId, workPackageId: pkg.id, idempotencyKey: input.idempotencyKey, updateNumber, method: pkg.measurementMethod, periodQuantity: input.quantity, unit: pkg.unit, effectiveAt: input.effectiveAt, location: input.location, notes: input.notes, status: "DRAFT", createdById: actorId } });
  await event(tenantId, actorId, "PROGRESS_UPDATE", row.id, "progress_update.drafted", `${input.quantity} ${pkg.unit} claimed for ${pkg.code}.`, pkg.projectId); return row;
}

export async function submitProgressUpdate(tenantId: string, actorId: string, id: string) {
  const row = assertTenant(await db.workProgressUpdate.findUnique({ where: { id } }), tenantId, "WorkProgressUpdate");
  if (!canTransitionProgressUpdate(row.status, "SUBMITTED")) throw new Error(`Cannot submit a claim in status ${row.status}.`);
  await db.workProgressUpdate.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date(), recordVersion: { increment: 1 } } });
  await event(tenantId, actorId, "PROGRESS_UPDATE", id, "progress_update.submitted", `${row.updateNumber} submitted for verification.`, row.projectId, row.status, "SUBMITTED");
}

export async function verifyProgressUpdate(tenantId: string, actorId: string, id: string, decision: "ACCEPTED" | "REJECTED", note?: string) {
  const row = assertTenant(await db.workProgressUpdate.findUnique({ where: { id }, include: { workPackage: true } }), tenantId, "WorkProgressUpdate");
  const from = row.status === "SUBMITTED" ? "SUBMITTED" : row.status;
  if (!canTransitionProgressUpdate(from, "UNDER_VERIFICATION") && !canTransitionProgressUpdate(from, decision)) throw new Error(`Cannot verify a claim in status ${row.status}.`);
  if (decision === "REJECTED") {
    await db.workProgressUpdate.update({ where: { id }, data: { status: "REJECTED", verifiedAt: new Date(), verifiedById: actorId, notes: note ? `${row.notes ?? ""}\nRejection: ${note}`.trim() : row.notes } });
    await event(tenantId, actorId, "PROGRESS_UPDATE", id, "progress_update.rejected", `${row.updateNumber} rejected.${note ? ` ${note}` : ""}`, row.projectId, row.status, "REJECTED");
    return;
  }
  validateAcceptedQuantity(row.workPackage.acceptedQuantity, row.periodQuantity, row.workPackage.approvedQuantity);
  await db.$transaction(async tx => {
    await tx.workProgressUpdate.update({ where: { id }, data: { status: "ACCEPTED", verifiedAt: new Date(), acceptedAt: new Date(), verifiedById: actorId } });
    await tx.workPackage.update({ where: { id: row.workPackageId }, data: { acceptedQuantity: { increment: row.periodQuantity }, status: row.workPackage.status === "READY" ? "IN_PROGRESS" : row.workPackage.status, recordVersion: { increment: 1 } } });
  });
  await event(tenantId, actorId, "PROGRESS_UPDATE", id, "progress_update.accepted", `${row.periodQuantity} ${row.unit} verified and accepted for ${row.workPackage.code}.`, row.projectId, row.status, "ACCEPTED");
}

export async function createEvidence(tenantId: string, actorId: string, input: { companyId: string; projectId: string; workPackageId?: string; progressUpdateId?: string; type?: string; title: string; url?: string; location?: string; capturedAt: Date; confidentiality?: string }) {
  await requireTenantProject(tenantId, input.projectId);
  const { companyId: _companyId, ...data } = input;
  const row = await db.workProgressEvidence.create({ data: { tenantId, createdById: actorId, ...data } });
  await event(tenantId, actorId, "EVIDENCE", row.id, "evidence.logged", `${row.title} captured.`, row.projectId); return row;
}

export async function createConstraint(tenantId: string, actorId: string, input: { companyId: string; projectId: string; workPackageId?: string; title: string; category: string; description?: string; impact: string; requiredBy?: Date }) { await requireTenantProject(tenantId, input.projectId); const number = await allocateNumber(tenantId, "WORK_CONSTRAINT"); const row = await db.workConstraint.create({ data: { tenantId, number, ownerId: actorId, createdById: actorId, ...input } }); await event(tenantId, actorId, "CONSTRAINT", row.id, "constraint.created", `${number} ${row.title} created.`, row.projectId); return row; }
export async function createDelay(tenantId: string, actorId: string, input: { companyId: string; projectId: string; workPackageId?: string; title: string; category: string; observedFact: string; allegedResponsibility?: string; startAt: Date; impactDays?: number; mitigation?: string }) { await requireTenantProject(tenantId, input.projectId); const number = await allocateNumber(tenantId, "WORK_DELAY"); const row = await db.workDelayEvent.create({ data: { tenantId, number, ownerId: actorId, createdById: actorId, ...input } }); await event(tenantId, actorId, "DELAY", row.id, "delay.created", `${number} ${row.title} recorded.`, row.projectId); return row; }
