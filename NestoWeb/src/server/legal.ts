import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { allocateNumber } from "@/server/number-series";

// ---------------------------------------------------------------------------
// PRD_Government_Legal_Compliance — Phase 1 (regulatory/permits foundation).
// Projects module is FROZEN (projects_module_frozen memory): every function
// here takes a plain projectId string and only ever reads Project fields for
// display (never writes, never adds a relation). "Files are evidence, not
// the business object" — structured data lives here; a scanned permit PDF
// would be a linked DocumentFile, not modeled in this module.
// ---------------------------------------------------------------------------

export async function listProjectsForPicker(tenantId: string) {
  return db.project.findMany({ where: { tenantId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
}

export async function listAuthorities(tenantId: string) {
  return db.legalAuthority.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createAuthority(tenantId: string, input: { name: string; category: string; contactInfo?: string }) {
  return db.legalAuthority.create({ data: { tenantId, ...input } });
}

export async function listPermits(tenantId: string) {
  return db.permit.findMany({
    where: { tenantId },
    include: { authority: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPermitsForProject(tenantId: string, projectId: string) {
  return db.permit.findMany({
    where: { tenantId, projectId },
    include: { authority: true, conditions: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPermitDetail(tenantId: string, permitId: string) {
  const permit = await db.permit.findUnique({
    where: { id: permitId },
    include: {
      authority: true,
      createdBy: true,
      conditions: { orderBy: { createdAt: "asc" } },
      amendments: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!permit || permit.tenantId !== tenantId) return null;

  const project = await db.project.findUnique({ where: { id: permit.projectId }, select: { id: true, name: true, code: true } });

  const activity = await db.legalActivity.findMany({
    where: { tenantId, entityType: "Permit", entityId: permitId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { permit, project, activity };
}

export async function createPermit(
  tenantId: string,
  actorId: string,
  input: { projectId: string; authorityId: string; permitType: string; referenceNumber?: string; confidentialityLevel?: string }
) {
  return db.$transaction(async (tx) => {
    const permit = await tx.permit.create({
      data: {
        tenantId,
        projectId: input.projectId,
        authorityId: input.authorityId,
        permitType: input.permitType,
        referenceNumber: input.referenceNumber,
        confidentialityLevel: input.confidentialityLevel ?? "STANDARD",
        createdById: actorId,
      },
    });
    await tx.legalActivity.create({
      data: { tenantId, entityType: "Permit", entityId: permit.id, actorId, eventType: "CREATED", summary: `Permit ${permit.permitType} drafted` },
    });
    return permit;
  });
}

// Status transitions are the only way to move a permit through its
// lifecycle — issuing sets issuedDate, and once ISSUED the core fields are
// only ever corrected via a PermitAmendment (see amendPermit below), never
// silently rewritten ("no silent overwrites" — the PRD's core rule).
export async function setPermitStatus(tenantId: string, actorId: string, permitId: string, status: string) {
  const permit = await db.permit.findUnique({ where: { id: permitId } });
  if (!permit || permit.tenantId !== tenantId) throw new Error("Permit not found.");

  return db.$transaction(async (tx) => {
    const updated = await tx.permit.update({
      where: { id: permitId },
      data: { status, ...(status === "ISSUED" && !permit.issuedDate ? { issuedDate: new Date() } : {}) },
    });
    await tx.legalActivity.create({
      data: { tenantId, entityType: "Permit", entityId: permitId, actorId, eventType: "STATUS_CHANGED", summary: `Permit status set to ${status}` },
    });
    return updated;
  });
}

export async function addPermitCondition(tenantId: string, permitId: string, input: { description: string; dueDate?: Date }) {
  const permit = await db.permit.findUnique({ where: { id: permitId } });
  if (!permit || permit.tenantId !== tenantId) throw new Error("Permit not found.");
  return db.permitCondition.create({ data: { tenantId, permitId, ...input } });
}

// Corrections to an ISSUED permit are new amendment records, never edits to
// the original — this is the "no silent overwrites" rule made concrete. The
// permit's own expiryDate is a denormalized "current effective value"
// pointer (same pattern as SalaryRecord's CURRENT/PREVIOUS), kept in sync so
// callers don't have to walk the amendment chain for the common case.
export async function amendPermit(
  tenantId: string,
  actorId: string,
  permitId: string,
  input: { description: string; newExpiryDate?: Date }
) {
  const permit = await db.permit.findUnique({ where: { id: permitId } });
  if (!permit || permit.tenantId !== tenantId) throw new Error("Permit not found.");

  return db.$transaction(async (tx) => {
    const amendment = await tx.permitAmendment.create({
      data: { tenantId, permitId, description: input.description, newExpiryDate: input.newExpiryDate, createdById: actorId },
    });
    if (input.newExpiryDate) {
      await tx.permit.update({ where: { id: permitId }, data: { expiryDate: input.newExpiryDate } });
    }
    await tx.legalActivity.create({
      data: { tenantId, entityType: "Permit", entityId: permitId, actorId, eventType: "AMENDED", summary: `Amendment recorded: ${input.description}` },
    });
    return amendment;
  });
}

export async function getProjectLegalStatus(tenantId: string, projectId: string) {
  const [project, permits, readiness] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, code: true, tenantId: true } }),
    listPermitsForProject(tenantId, projectId),
    db.legalReadinessStatus.findUnique({ where: { projectId } }),
  ]);
  if (!project || project.tenantId !== tenantId) return null;

  const activity = await db.legalActivity.findMany({
    where: { tenantId, entityType: "LegalReadinessStatus", entityId: projectId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return { project, permits, readiness, activity };
}

// Phase 1: manual, Legal-permissioned setting — the PRD's full automatic
// engine (derived from permit/obligation state) is later work. Still an
// upsert-as-history-of-one pattern: the row is the *current* gate value, and
// every change is logged to LegalActivity so the history isn't lost.
export async function setLegalReadinessStatus(tenantId: string, actorId: string, projectId: string, status: string, reason?: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.legalReadinessStatus.upsert({
      where: { projectId },
      create: { tenantId, projectId, status, reason, setById: actorId },
      update: { status, reason, setById: actorId },
    });
    await tx.legalActivity.create({
      data: {
        tenantId,
        entityType: "LegalReadinessStatus",
        entityId: projectId,
        actorId,
        eventType: "GATE_SET",
        summary: `Legal Readiness Gate set to ${status}${reason ? ` — ${reason}` : ""}`,
      },
    });
    return updated;
  });
}

export async function listReadinessStatuses(tenantId: string) {
  return db.legalReadinessStatus.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } });
}

// ---------------------------------------------------------------------------
// Cases, Disputes & Legal Hold — Phase 3. See the schema comment above
// LegalCase for the confidentiality-tier collapse. The rule that matters is
// enforced here, not just in the UI: STANDARD/RESTRICTED cases are visible
// to anyone with LEGAL/READ; CONFIDENTIAL-and-up require either having
// opened the case or an explicit LegalCaseAccess grant — "project access
// does not automatically grant case access" applies just as much to LEGAL
// role membership as it does to project-team membership.
// ---------------------------------------------------------------------------

type CaseViewer = { userId: string; role: Role };

const GRANT_REQUIRED_TIERS = new Set(["CONFIDENTIAL", "LEGAL_PRIVILEGED", "EXECUTIVE", "LITIGATION_RESTRICTED", "EXTERNAL_COUNSEL_ONLY"]);

async function visibleCaseIdsForGrantRequiredTiers(tenantId: string, userId: string) {
  const [opened, granted] = await Promise.all([
    db.legalCase.findMany({ where: { tenantId, openedById: userId }, select: { id: true } }),
    db.legalCaseAccess.findMany({ where: { tenantId, userId, revokedAt: null }, select: { caseId: true } }),
  ]);
  return new Set([...opened.map((c) => c.id), ...granted.map((g) => g.caseId)]);
}

export async function listLegalCases(tenantId: string, viewer: CaseViewer) {
  const cases = await db.legalCase.findMany({ where: { tenantId }, orderBy: { openedAt: "desc" } });
  const canReadStandard = can(viewer.role, "LEGAL", "READ");
  const visibleGrantIds = await visibleCaseIdsForGrantRequiredTiers(tenantId, viewer.userId);
  return cases.filter((c) => (GRANT_REQUIRED_TIERS.has(c.confidentialityTier) ? visibleGrantIds.has(c.id) : canReadStandard));
}

export async function getLegalCase(tenantId: string, caseId: string, viewer: CaseViewer) {
  const legalCase = await db.legalCase.findUnique({ where: { id: caseId } });
  if (!legalCase || legalCase.tenantId !== tenantId) return null;

  if (GRANT_REQUIRED_TIERS.has(legalCase.confidentialityTier)) {
    const visibleGrantIds = await visibleCaseIdsForGrantRequiredTiers(tenantId, viewer.userId);
    if (!visibleGrantIds.has(legalCase.id)) return null;
  } else if (!can(viewer.role, "LEGAL", "READ")) {
    return null;
  }

  const [accessGrants, activity, holds] = await Promise.all([
    db.legalCaseAccess.findMany({ where: { tenantId, caseId, revokedAt: null }, orderBy: { grantedAt: "desc" } }),
    db.legalActivity.findMany({ where: { tenantId, entityType: "LegalCase", entityId: caseId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.legalHold.findMany({ where: { tenantId, caseId }, orderBy: { placedAt: "desc" } }),
  ]);

  const project = legalCase.projectId ? await db.project.findUnique({ where: { id: legalCase.projectId }, select: { id: true, name: true, code: true } }) : null;

  return { legalCase, project, accessGrants, activity, holds };
}

export async function createLegalCase(
  tenantId: string,
  actorId: string,
  input: { title: string; caseType: string; projectId?: string; counterparty?: string; summary?: string; confidentialityTier?: string }
) {
  const caseNumber = await allocateNumber(tenantId, "LEGAL_CASE");
  return db.$transaction(async (tx) => {
    const legalCase = await tx.legalCase.create({ data: { tenantId, caseNumber, openedById: actorId, ...input } });
    await tx.legalActivity.create({
      data: { tenantId, entityType: "LegalCase", entityId: legalCase.id, actorId, eventType: "CREATED", summary: `Case ${legalCase.caseNumber} opened` },
    });
    return legalCase;
  });
}

const CASE_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "ON_HOLD", "RESOLVED"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
  ON_HOLD: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export async function setLegalCaseStatus(tenantId: string, actorId: string, caseId: string, status: string) {
  const legalCase = await db.legalCase.findUnique({ where: { id: caseId } });
  if (!legalCase || legalCase.tenantId !== tenantId) throw new Error("Case not found.");
  if (!CASE_TRANSITIONS[legalCase.status]?.includes(status)) throw new Error(`Cannot move a ${legalCase.status} case to ${status}.`);

  return db.$transaction(async (tx) => {
    const updated = await tx.legalCase.update({
      where: { id: caseId },
      data: { status, closedAt: status === "CLOSED" ? new Date() : legalCase.closedAt },
    });
    await tx.legalActivity.create({
      data: { tenantId, entityType: "LegalCase", entityId: caseId, actorId, eventType: "STATUS_CHANGED", summary: `Case status set to ${status}` },
    });
    return updated;
  });
}

export async function grantCaseAccess(tenantId: string, actorId: string, caseId: string, userId: string) {
  const legalCase = await db.legalCase.findUnique({ where: { id: caseId } });
  if (!legalCase || legalCase.tenantId !== tenantId) throw new Error("Case not found.");
  const grant = await db.legalCaseAccess.upsert({
    where: { caseId_userId: { caseId, userId } },
    create: { tenantId, caseId, userId, grantedById: actorId },
    update: { revokedAt: null, grantedById: actorId, grantedAt: new Date() },
  });
  await db.legalActivity.create({
    data: { tenantId, entityType: "LegalCase", entityId: caseId, actorId, eventType: "ACCESS_GRANTED", summary: "Case access granted" },
  });
  return grant;
}

export async function revokeCaseAccess(tenantId: string, actorId: string, accessId: string) {
  const grant = await db.legalCaseAccess.findUnique({ where: { id: accessId } });
  if (!grant || grant.tenantId !== tenantId) throw new Error("Access grant not found.");
  const updated = await db.legalCaseAccess.update({ where: { id: accessId }, data: { revokedAt: new Date() } });
  await db.legalActivity.create({
    data: { tenantId, entityType: "LegalCase", entityId: grant.caseId, actorId, eventType: "ACCESS_REVOKED", summary: "Case access revoked" },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Legal Hold — registry only, see schema note above LegalHold.
// ---------------------------------------------------------------------------

export async function listLegalHolds(tenantId: string) {
  return db.legalHold.findMany({ where: { tenantId }, orderBy: { placedAt: "desc" } });
}

export async function createLegalHold(tenantId: string, actorId: string, input: { caseId?: string; scope: string; targetType?: string; targetId?: string }) {
  return db.legalHold.create({ data: { tenantId, placedById: actorId, ...input } });
}

export async function releaseLegalHold(tenantId: string, actorId: string, holdId: string) {
  const hold = await db.legalHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.tenantId !== tenantId) throw new Error("Hold not found.");
  if (hold.status !== "ACTIVE") throw new Error("Hold is already released.");
  return db.legalHold.update({ where: { id: holdId }, data: { status: "RELEASED", releasedById: actorId, releasedAt: new Date() } });
}
