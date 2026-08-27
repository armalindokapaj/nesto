import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";
import { canViewTask, type TaskVisibilityRecord } from "@/lib/project-access";
import type { Role } from "@/lib/constants";

export async function listDrawings(tenantId: string, status?: string) {
  return db.drawing.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { project: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRfis(tenantId: string, status?: string) {
  return db.rFI.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Drawing revisions (§17) — additive over the existing Drawing status field.
// ---------------------------------------------------------------------------

export async function listDrawingRevisions(tenantId: string, drawingId: string) {
  assertTenant(await db.drawing.findUnique({ where: { id: drawingId } }), tenantId, "Drawing");
  return db.drawingRevision.findMany({ where: { tenantId, drawingId }, orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, displayName: true } } } });
}

export async function createDrawingRevision(
  tenantId: string,
  actorId: string,
  input: { drawingId: string; code: string; description?: string; fileUrl?: string }
) {
  const drawing = assertTenant(await db.drawing.findUnique({ where: { id: input.drawingId } }), tenantId, "Drawing");
  return db.$transaction(async (tx) => {
    // Prior current revision becomes superseded — never presented as current (§15.2).
    await tx.drawingRevision.updateMany({ where: { tenantId, drawingId: drawing.id, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    const revision = await tx.drawingRevision.create({
      data: { tenantId, drawingId: drawing.id, code: input.code, description: input.description, fileUrl: input.fileUrl, authorId: actorId, status: "SUBMITTED" },
    });
    await tx.drawing.update({ where: { id: drawing.id }, data: { revisionCode: input.code, status: "IN_REVIEW" } });
    return revision;
  });
}

export async function decideDrawingRevision(tenantId: string, revisionId: string, decision: "APPROVED" | "RETURNED") {
  const revision = assertTenant(await db.drawingRevision.findUnique({ where: { id: revisionId } }), tenantId, "DrawingRevision");
  return db.$transaction(async (tx) => {
    await tx.drawingRevision.update({ where: { id: revision.id }, data: { status: decision } });
    await tx.drawing.update({ where: { id: revision.drawingId }, data: { status: decision === "APPROVED" ? "APPROVED" : "NEEDS_REVISION" } });
  });
}

// ---------------------------------------------------------------------------
// RFI response (§16/§18)
// ---------------------------------------------------------------------------

export async function respondToRfi(tenantId: string, actorId: string, input: { rfiId: string; response: string }) {
  assertTenant(await db.rFI.findUnique({ where: { id: input.rfiId } }), tenantId, "RFI");
  return db.rFI.update({
    where: { id: input.rfiId },
    data: { response: input.response, respondedById: actorId, respondedAt: new Date(), status: "ANSWERED" },
  });
}

// ---------------------------------------------------------------------------
// Submittals (§19, shared by Architecture & Engineering)
// ---------------------------------------------------------------------------

export async function listSubmittals(tenantId: string, projectId?: string) {
  return db.submittal.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true } }, submitter: { select: { id: true, displayName: true } } },
  });
}

export async function createSubmittal(
  tenantId: string,
  actorId: string,
  input: { projectId: string; type: string; title: string; discipline?: string; description?: string; dueDate?: Date; fileUrl?: string }
) {
  const number = await allocateNumber(tenantId, "SUBMITTAL");
  return db.submittal.create({ data: { tenantId, number, submitterId: actorId, ...input } });
}

export async function decideSubmittal(tenantId: string, actorId: string, input: { id: string; decision: "APPROVED" | "REJECTED" | "RETURNED"; comment?: string }) {
  const submittal = assertTenant(await db.submittal.findUnique({ where: { id: input.id } }), tenantId, "Submittal");
  // Status is OPEN | IN_REVIEW | APPROVED | REJECTED | RETURNED. RETURNED is a
  // resubmission state, not a terminal one, so it stays decidable — only the
  // two final outcomes are blocked, otherwise an approved submittal could be
  // silently flipped to rejected (or the reverse) with no record of the first
  // decision.
  if (submittal.status === "APPROVED" || submittal.status === "REJECTED") {
    throw new Error(`This submittal has already been decided (status: ${submittal.status}).`);
  }
  const result = await db.submittal.updateMany({
    where: { id: input.id, status: { notIn: ["APPROVED", "REJECTED"] } },
    data: { status: input.decision, reviewerId: actorId, decidedAt: new Date(), comment: input.comment },
  });
  if (result.count === 0) throw new Error("This submittal was just decided by someone else.");
  return db.submittal.findUniqueOrThrow({ where: { id: input.id } });
}

// ---------------------------------------------------------------------------
// Client Requests (§20 — Architect-side)
// ---------------------------------------------------------------------------

export async function listClientRequests(tenantId: string, projectId?: string) {
  return db.clientRequest.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assignedArchitect: { select: { id: true, displayName: true } },
    },
  });
}

export async function updateClientRequestStatus(tenantId: string, id: string, status: string) {
  assertTenant(await db.clientRequest.findUnique({ where: { id } }), tenantId, "ClientRequest");
  return db.clientRequest.update({ where: { id }, data: { status } });
}

export async function assignClientRequest(tenantId: string, id: string, assignedArchitectId: string) {
  assertTenant(await db.clientRequest.findUnique({ where: { id } }), tenantId, "ClientRequest");
  return db.clientRequest.update({ where: { id }, data: { assignedArchitectId, status: "IN_PROGRESS" } });
}

// ---------------------------------------------------------------------------
// Architect Dashboard — exact 7-region layout (§5)
// ---------------------------------------------------------------------------

const CLOSED_TASK_STATUSES = new Set(["COMPLETED", "APPROVED", "REJECTED"]);

export async function getArchitectDashboard(tenantId: string, viewer: { userId: string; role: Role }) {
  const memberships = await db.projectMember.findMany({ where: { userId: viewer.userId, project: { tenantId } }, select: { projectId: true } });
  const projectIds = memberships.map((m) => m.projectId);

  const [projects, drawings, rfis, revisions, submittals, clientRequests, myTasks, meetings] = await Promise.all([
    db.project.findMany({ where: { tenantId, id: { in: projectIds }, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    db.drawing.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.rFI.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.drawingRevision.findMany({ where: { tenantId, drawing: { projectId: { in: projectIds } }, status: "SUBMITTED" }, include: { drawing: { select: { id: true, projectId: true, packageName: true } } } }),
    db.submittal.findMany({ where: { tenantId, projectId: { in: projectIds } } }),
    db.clientRequest.findMany({ where: { tenantId, projectId: { in: projectIds } }, include: { project: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } } }),
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
  const pendingDrawings = drawings.filter((d) => d.status !== "APPROVED");

  // §6 — exact four cues.
  const cues = {
    activeProjects: projects.filter((p) => p.status === "ACTIVE" || p.status === "ON_TRACK").length,
    pendingDrawings: pendingDrawings.length,
    openRfis: openRfis.length,
    revisionsAwaitingApproval: revisions.length,
  };

  const myProjects = projects.map((p) => {
    const pDrawings = drawings.filter((d) => d.projectId === p.id);
    const pRfis = rfis.filter((r) => r.projectId === p.id && (r.status === "OPEN" || r.status === "OVERDUE"));
    const pRevisions = revisions.filter((r) => r.drawing.projectId === p.id);
    const pClientRequests = clientRequests.filter((c) => c.projectId === p.id && c.status !== "APPROVED" && c.status !== "REJECTED");
    const pTasks = myOpenTasks.filter((t) => t.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      attentionChips: {
        openRfis: pRfis.length,
        pendingDrawings: pDrawings.filter((d) => d.status !== "APPROVED").length,
        revisionsAwaiting: pRevisions.length,
        clientRequests: pClientRequests.length,
        tasks: pTasks.length,
      },
      nextDeadline: pTasks[0]?.dueDate ?? null,
    };
  });

  const inbox = [
    ...myOpenTasks.map((t) => ({ type: "TASK" as const, id: t.id, title: t.title, projectId: t.projectId, dueDate: t.dueDate, href: `/tasks/${t.id}` })),
    ...openRfis
      .filter((r) => r.assignedToId === viewer.userId)
      .map((r) => ({ type: "RFI" as const, id: r.id, title: r.title, projectId: r.projectId, dueDate: r.dueDate, href: `/dashboard/architect/rfis?id=${r.id}` })),
    ...revisions.map((r) => ({ type: "REVISION" as const, id: r.id, title: `${r.drawing.packageName} — ${r.code}`, projectId: r.drawing.projectId, dueDate: null as Date | null, href: `/dashboard/architect/drawings/${r.drawing.id}` })),
    ...clientRequests
      .filter((c) => c.assignedArchitectId === viewer.userId && (c.status === "REQUESTED" || c.status === "IN_PROGRESS"))
      .map((c) => ({ type: "CLIENT_REQUEST" as const, id: c.id, title: `${c.client.name} — ${c.requestType}`, projectId: c.projectId, dueDate: c.dueDate, href: `/dashboard/architect/client-requests/${c.id}` })),
  ].sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  return {
    cues,
    myProjects,
    inbox: inbox.slice(0, 20),
    designStatus: {
      drawings: statusCounts(drawings),
      rfis: { open: openRfis.length, overdue: rfis.filter((r) => r.status === "OVERDUE").length, answered: rfis.filter((r) => r.status === "ANSWERED").length },
      revisions: statusCounts(revisions),
      submittals: statusCounts(submittals),
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

export async function getProjectArchitectureOverview(tenantId: string, projectId: string) {
  const [drawings, rfis, submittals, clientRequests] = await Promise.all([
    db.drawing.findMany({ where: { tenantId, projectId } }),
    db.rFI.findMany({ where: { tenantId, projectId } }),
    db.submittal.findMany({ where: { tenantId, projectId } }),
    db.clientRequest.findMany({ where: { tenantId, projectId } }),
  ]);
  return {
    drawings: drawings.length,
    pendingDrawings: drawings.filter((d) => d.status !== "APPROVED").length,
    openRfis: rfis.filter((r) => r.status === "OPEN" || r.status === "OVERDUE").length,
    openSubmittals: submittals.filter((s) => s.status === "OPEN" || s.status === "IN_REVIEW").length,
    openClientRequests: clientRequests.filter((c) => c.status !== "APPROVED" && c.status !== "REJECTED").length,
  };
}
