import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import { canViewTask, type TaskVisibilityRecord } from "@/lib/project-access";
import type { Role } from "@/lib/constants";

// PRD_Engineer_Dashboard — Engineering Packages / Specifications /
// Calculations / Coordination server layer. Every record here is a
// project-linked technical grouping/record, never a copy of Documents,
// Tasks, QA/QC or BIM truth (§15/§16/§17/§21).

// ---------------------------------------------------------------------------
// Engineering Packages
// ---------------------------------------------------------------------------

export async function listEngineeringPackages(tenantId: string, projectId?: string) {
  return db.engineeringPackage.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      owner: { select: { id: true, displayName: true } },
      _count: { select: { specifications: true, calculations: true } },
    },
  });
}

export async function createEngineeringPackage(
  tenantId: string,
  input: { projectId: string; title: string; discipline?: string; scope?: string; ownerId?: string; dueDate?: Date }
) {
  const code = await allocateNumber(tenantId, "ENGINEERING_PACKAGE");
  return db.engineeringPackage.create({ data: { tenantId, code, ...input } });
}

// ---------------------------------------------------------------------------
// Specifications
// ---------------------------------------------------------------------------

export async function listSpecifications(tenantId: string, projectId?: string) {
  return db.specification.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true } }, author: { select: { id: true, displayName: true } } },
  });
}

export async function createSpecification(
  tenantId: string,
  actorId: string,
  input: { projectId: string; title: string; discipline?: string; category?: string; scope?: string; packageId?: string; fileUrl?: string }
) {
  const code = await allocateNumber(tenantId, "SPECIFICATION");
  return db.specification.create({ data: { tenantId, code, authorId: actorId, ...input } });
}

// ---------------------------------------------------------------------------
// Calculations
// ---------------------------------------------------------------------------

export async function listCalculations(tenantId: string, projectId?: string) {
  return db.calculation.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, displayName: true } },
      checker: { select: { id: true, displayName: true } },
    },
  });
}

export async function createCalculation(
  tenantId: string,
  actorId: string,
  input: {
    projectId: string;
    title: string;
    discipline?: string;
    type?: string;
    technicalScope?: string;
    assumptions?: string;
    packageId?: string;
    checkerId?: string;
    fileUrl?: string;
  }
) {
  const code = await allocateNumber(tenantId, "CALCULATION");
  return db.calculation.create({ data: { tenantId, code, authorId: actorId, ...input } });
}

// ---------------------------------------------------------------------------
// Coordination (BIM-owned issues, §21)
// ---------------------------------------------------------------------------

export async function listCoordinationIssues(tenantId: string, projectId?: string) {
  return db.coordinationIssue.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function createCoordinationIssue(
  tenantId: string,
  actorId: string,
  input: { projectId: string; title: string; discipline?: string; priority?: string; bimModelId?: string; viewpointRef?: string; assignedToId?: string }
) {
  return db.coordinationIssue.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function updateCoordinationIssueStatus(tenantId: string, id: string, status: string) {
  assertTenant(await db.coordinationIssue.findUnique({ where: { id } }), tenantId, "CoordinationIssue");
  return db.coordinationIssue.update({ where: { id }, data: { status } });
}

// ---------------------------------------------------------------------------
// Engineer Dashboard aggregator
// ---------------------------------------------------------------------------

const CLOSED_TASK_STATUSES = new Set(["COMPLETED", "APPROVED", "REJECTED"]);

export async function getEngineerDashboard(tenantId: string, viewer: { userId: string; role: Role }) {
  // "Assigned projects" — Pass-1 scope: projects where the user is a
  // ProjectMember. Mirrors the same relation Projects itself already uses
  // for membership (read-only reference, not a new assignment model).
  const memberships = await db.projectMember.findMany({ where: { userId: viewer.userId, project: { tenantId } }, select: { projectId: true } });
  const projectIds = memberships.map((m) => m.projectId);

  const [projects, drawings, rfis, submittals, inspections, packages, specs, calcs, coordination, myTasks, meetings] = await Promise.all([
    db.project.findMany({ where: { tenantId, id: { in: projectIds }, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    db.drawing.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.rFI.findMany({ where: { tenantId, projectId: { in: projectIds } }, include: { project: { select: { id: true, name: true } } } }),
    db.submittal.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.inspectionRequest.findMany({
      where: { tenantId, projectId: { in: projectIds }, OR: [{ inspectorId: viewer.userId }, { requesterId: viewer.userId }] },
      include: { project: { select: { id: true, name: true } } },
    }),
    db.engineeringPackage.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.specification.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.calculation.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.coordinationIssue.findMany({ where: { tenantId, projectId: { in: projectIds }, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.task.findMany({
      where: { tenantId, projectId: { in: projectIds }, status: { notIn: Array.from(CLOSED_TASK_STATUSES) } },
      include: { contributions: { select: { userId: true } }, participants: { select: { userId: true, role: true } } },
      orderBy: { dueDate: "asc" },
      take: 60,
    }),
    db.meeting.findMany({ where: { tenantId, projectId: { in: projectIds }, status: "PLANNED", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 5 }),
  ]);

  const visibleTasks = myTasks.filter((t) => canViewTask(t as unknown as TaskVisibilityRecord, viewer));
  const myOpenTasks = visibleTasks.filter((t) => t.mainResponsibleId === viewer.userId || t.createdById === viewer.userId || t.participants.some((p) => p.userId === viewer.userId));

  const openRfis = rfis.filter((r) => r.status === "OPEN" || r.status === "OVERDUE");
  const actionableInspections = inspections.filter((i) => ["REQUESTED", "SCHEDULED", "READY", "IN_INSPECTION", "REINSPECTION_REQUIRED"].includes(i.status));

  // Primary cues — exact four (§6).
  const cues = {
    technicalTasks: myOpenTasks.length,
    openRfis: openRfis.length,
    inspections: actionableInspections.length,
    approvals: 0, // Approvals & Workflow not yet wired to these record types — honestly zero, not fabricated.
  };

  // My Projects — attention chips per project.
  const myProjects = projects.map((p) => {
    const pDrawings = drawings.filter((d) => d.projectId === p.id);
    const pRfis = rfis.filter((r) => r.projectId === p.id && (r.status === "OPEN" || r.status === "OVERDUE"));
    const pInspections = actionableInspections.filter((i) => i.projectId === p.id);
    const pCoordination = coordination.filter((c) => c.projectId === p.id);
    const pTasks = myOpenTasks.filter((t) => t.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      attentionChips: { openRfis: pRfis.length, inspections: pInspections.length, coordination: pCoordination.length, tasks: pTasks.length, pendingDrawings: pDrawings.filter((d) => d.status !== "APPROVED").length },
      nextDeadline: pTasks[0]?.dueDate ?? null,
    };
  });

  // Needs My Attention — merged work inbox.
  const inbox = [
    ...myOpenTasks.map((t) => ({ type: "TASK" as const, id: t.id, title: t.title, projectId: t.projectId, dueDate: t.dueDate, href: `/tasks/${t.id}` })),
    ...openRfis
      .filter((r) => r.assignedToId === viewer.userId)
      .map((r) => ({ type: "RFI" as const, id: r.id, title: r.title, projectId: r.projectId, dueDate: r.dueDate, href: `/dashboard/architect/rfis?id=${r.id}` })),
    ...actionableInspections
      .filter((i) => i.inspectorId === viewer.userId)
      .map((i) => ({ type: "INSPECTION" as const, id: i.id, title: i.number, projectId: i.projectId, dueDate: i.plannedDate, href: `/dashboard/engineering/inspections/${i.id}` })),
  ].sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  return {
    cues,
    myProjects,
    inbox: inbox.slice(0, 20),
    technicalStatus: {
      packages: statusCounts(packages),
      specifications: statusCounts(specs),
      calculations: statusCounts(calcs),
      rfis: { open: openRfis.length, overdue: rfis.filter((r) => r.status === "OVERDUE").length, answered: rfis.filter((r) => r.status === "ANSWERED").length },
      submittals: statusCounts(submittals),
      inspections: statusCounts(inspections),
      coordination: coordination.length,
    },
    upcoming: {
      taskDeadlines: myOpenTasks.filter((t) => t.dueDate).slice(0, 5),
      meetings,
    },
    projectIds,
  };
}

function statusCounts<T extends { status: string }>(rows: T[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
  return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
}

export async function getProjectEngineeringOverview(tenantId: string, projectId: string) {
  const [drawings, rfis, submittals, inspections, packages, specs, calcs, coordination] = await Promise.all([
    db.drawing.count({ where: { tenantId, projectId } }),
    db.rFI.findMany({ where: { tenantId, projectId } }),
    db.submittal.findMany({ where: { tenantId, projectId } }),
    db.inspectionRequest.findMany({ where: { tenantId, projectId } }),
    db.engineeringPackage.findMany({ where: { tenantId, projectId } }),
    db.specification.findMany({ where: { tenantId, projectId } }),
    db.calculation.findMany({ where: { tenantId, projectId } }),
    db.coordinationIssue.findMany({ where: { tenantId, projectId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  return {
    drawingsCount: drawings,
    openRfis: rfis.filter((r) => r.status === "OPEN" || r.status === "OVERDUE").length,
    openSubmittals: submittals.filter((s) => s.status === "OPEN" || s.status === "IN_REVIEW").length,
    pendingInspections: inspections.filter((i) => i.status !== "RESULT_ISSUED").length,
    packages: packages.length,
    specs: specs.length,
    calcs: calcs.length,
    coordinationOpen: coordination.length,
  };
}
