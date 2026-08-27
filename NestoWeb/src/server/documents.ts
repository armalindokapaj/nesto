import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject, requireTenantClient, requireTenantTask, requireTenantUnit } from "@/lib/tenant";
import { buildActorSnapshot } from "@/lib/actor-snapshot";
import { emitDomainEvent, dispatchDomainEvents } from "@/lib/domain-events";
import { can } from "@/lib/permissions";
import { writeFileToStorage } from "@/lib/storage";
import type { Role } from "@/lib/constants";

// Documents — the per-record attachment API used by the Projects, Tasks,
// Units and Clients pages: upload, revision, and the approval that binds to
// one revision. Deliberately separate from documents-module.ts, which is the
// folder-tree / Document Passport / shortcut layer. Different consumers and
// different lifecycles: a task attachment never enters the folder tree, and
// changing the tree must never risk the attachment approval path.

// Uint8Array<ArrayBuffer> (not Node's Buffer) — matches what Prisma's `Bytes`
// scalar expects and what `file.arrayBuffer()` naturally produces.
type UploadedFile = { data: Uint8Array<ArrayBuffer>; mimeType: string; size: number };

export async function listDocuments(tenantId: string) {
  // PRD_18 §12 — the flat list shows only the latest revision per lineage;
  // superseded revisions remain fully visible via the detail page's
  // revision chain, never deleted.
  return db.documentFile.findMany({
    where: { tenantId, supersededBy: null },
    include: { project: true, uploadedBy: true, task: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTaskDocuments(tenantId: string, taskId: string) {
  return db.documentFile.findMany({
    where: { tenantId, taskId, supersededBy: null },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listProjectDocuments(tenantId: string, projectId: string) {
  return db.documentFile.findMany({
    where: { tenantId, projectId, supersededBy: null },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listUnitDocuments(tenantId: string, unitId: string) {
  return db.documentFile.findMany({
    where: { tenantId, unitId, supersededBy: null },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocument(
  tenantId: string,
  input: {
    name: string;
    category?: string;
    projectId?: string;
    taskId?: string;
    clientId?: string;
    unitId?: string;
    uploadedById: string;
    // Optional — placeholder "expected document" call sites (project/task
    // creation) omit this; the generic Documents module's own create action
    // requires it.
    file?: UploadedFile;
  }
) {
  await Promise.all([
    input.projectId ? requireTenantProject(tenantId, input.projectId) : null,
    input.taskId ? requireTenantTask(tenantId, input.taskId) : null,
    input.clientId ? requireTenantClient(tenantId, input.clientId) : null,
    input.unitId ? requireTenantUnit(tenantId, input.unitId) : null,
  ]);

  const id = randomUUID();
  const stored = input.file
    ? await writeFileToStorage("documentFile", id, input.name, input.file.data, input.file.mimeType)
    : undefined;
  const uploaderSnapshot = input.file ? await buildActorSnapshot(db, tenantId, input.uploadedById) : undefined;

  return db.documentFile.create({
    data: {
      id,
      tenantId,
      name: input.name,
      category: input.category ?? "General",
      projectId: input.projectId,
      taskId: input.taskId,
      clientId: input.clientId,
      unitId: input.unitId,
      uploadedById: input.uploadedById,
      fileUrl: stored?.url,
      fileMimeType: input.file?.mimeType,
      fileSize: stored?.size,
      checksum: stored?.checksum,
      uploaderSnapshot: uploaderSnapshot ? JSON.stringify(uploaderSnapshot) : undefined,
    },
  });
}

async function loadRevision(tenantId: string, id: string) {
  return assertTenant(
    await db.documentFile.findUnique({
      where: { id },
      include: {
        uploadedBy: true,
        approvedBy: true,
        project: true,
        task: true,
        client: true,
        approvals: { include: { approver: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    tenantId,
    "DocumentFile"
  );
}

type DocumentRevision = Awaited<ReturnType<typeof loadRevision>>;

// PRD_18 §12-13 Document Passport — the full revision chain (oldest to
// newest), each revision's approval decisions, and its activity timeline.
// `requestedId` may be any revision in the chain, not just the current head,
// so a link to an older/superseded revision still shows full context.
export async function getDocumentDetail(tenantId: string, id: string) {
  const requested = assertTenant(await db.documentFile.findUnique({ where: { id } }), tenantId, "DocumentFile");

  let oldestId = requested.id;
  let walkCursor = requested;
  while (walkCursor.supersedesId) {
    walkCursor = assertTenant(
      await db.documentFile.findUnique({ where: { id: walkCursor.supersedesId } }),
      tenantId,
      "DocumentFile"
    );
    oldestId = walkCursor.id;
  }

  const chain: DocumentRevision[] = [];
  let nextId: string | null = oldestId;
  while (nextId) {
    const revision: DocumentRevision = await loadRevision(tenantId, nextId);
    chain.push(revision);
    const child: { id: string } | null = await db.documentFile.findFirst({
      where: { tenantId, supersedesId: nextId },
      select: { id: true },
    });
    nextId = child?.id ?? null;
  }

  const timeline = await db.timelineEvent.findMany({
    where: { tenantId, entityType: "DocumentFile", entityId: { in: chain.map((r) => r.id) } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return { requestedId: requested.id, chain, timeline };
}

// PRD_18 §13 — uploading a new revision requires a mandatory change summary
// and never overwrites the previous file; the previous revision immediately
// becomes SUPERSEDED but keeps its Blue Ticket data untouched.
export async function uploadDocumentRevision(
  tenantId: string,
  input: { supersedesId: string; name?: string; revisionComment: string; uploadedById: string; file: UploadedFile }
) {
  if (!input.revisionComment.trim()) {
    throw new Error("A revision comment explaining what changed is required.");
  }

  const prev = assertTenant(await db.documentFile.findUnique({ where: { id: input.supersedesId } }), tenantId, "DocumentFile");
  const alreadySuperseded = await db.documentFile.findFirst({ where: { tenantId, supersedesId: prev.id }, select: { id: true } });
  if (alreadySuperseded) {
    throw new Error("This revision has already been superseded by a newer one.");
  }

  const revisionId = randomUUID();
  const stored = await writeFileToStorage(
    "documentFile",
    revisionId,
    input.name ?? prev.name,
    input.file.data,
    input.file.mimeType
  );
  const uploaderSnapshot = await buildActorSnapshot(db, tenantId, input.uploadedById);

  return db.$transaction(async (tx) => {
    const revision = await tx.documentFile.create({
      data: {
        id: revisionId,
        tenantId,
        projectId: prev.projectId,
        taskId: prev.taskId,
        clientId: prev.clientId,
        employeeId: prev.employeeId,
        visibility: prev.visibility,
        name: input.name ?? prev.name,
        category: prev.category,
        version: prev.version + 1,
        status: "DRAFT",
        uploadedById: input.uploadedById,
        supersedesId: prev.id,
        fileUrl: stored.url,
        fileMimeType: input.file.mimeType,
        fileSize: stored.size,
        checksum: stored.checksum,
        revisionComment: input.revisionComment,
        uploaderSnapshot: JSON.stringify(uploaderSnapshot),
      },
    });

    await tx.documentFile.update({ where: { id: prev.id }, data: { status: "SUPERSEDED" } });

    await tx.timelineEvent.create({
      data: {
        tenantId,
        entityType: "DocumentFile",
        entityId: revision.id,
        eventType: "REVISION_UPLOADED",
        actorId: input.uploadedById,
        metadata: JSON.stringify({ revisionComment: input.revisionComment, previousRevisionId: prev.id }),
      },
    });

    return revision;
  });
}

// PRD_18 §13 — a comment/tag is not an approval; this converts a request
// into a formal approval workflow only after confirming the target approver
// actually has approval authority.
export async function requestDocumentApproval(
  tenantId: string,
  documentFileId: string,
  requestedApproverId: string,
  actorId: string
) {
  const doc = assertTenant(await db.documentFile.findUnique({ where: { id: documentFileId } }), tenantId, "DocumentFile");
  if (doc.status === "APPROVED") throw new Error("This revision is already approved.");
  if (doc.status === "SUPERSEDED") throw new Error("A superseded revision cannot be submitted for approval.");

  const approverMembership = await db.companyMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: requestedApproverId } },
  });
  if (!approverMembership || !can(approverMembership.role as Role, "DOCUMENTS", "FULL")) {
    throw new Error("The selected person does not have approval authority for documents.");
  }

  const eventId = await db.$transaction(async (tx) => {
    await tx.documentFile.update({ where: { id: documentFileId }, data: { status: "SUBMITTED" } });
    if (doc.documentId) {
      await tx.document.update({ where: { id: doc.documentId }, data: { status: "AWAITING_APPROVAL" } });
    }

    await tx.notification.create({
      data: {
        tenantId,
        userId: requestedApproverId,
        type: "DOCUMENT_APPROVAL_REQUESTED",
        title: "Document approval requested",
        body: doc.name,
        link: `/documents/${documentFileId}`,
      },
    });

    await tx.timelineEvent.create({
      data: {
        tenantId,
        entityType: "DocumentFile",
        entityId: documentFileId,
        eventType: "APPROVAL_REQUESTED",
        actorId,
        metadata: JSON.stringify({ requestedApproverId }),
      },
    });

    return emitDomainEvent(
      tx,
      tenantId,
      "DocumentRevisionSubmitted",
      { documentFileId, requestedApproverId, name: doc.name },
      {
        actorUserId: actorId,
        actorSnapshot: await buildActorSnapshot(tx, tenantId, actorId),
        sourceModule: "Documents",
        sourceRecordId: documentFileId,
        projectId: doc.projectId ?? undefined,
      }
    );
  });

  await dispatchDomainEvents([eventId]);
}

// PRD_18 §13 Blue Approval Ticket — an append-only decision, bound to this
// exact revision's checksum by construction (a new revision is a new row).
export async function decideDocumentApproval(
  tenantId: string,
  documentFileId: string,
  approverId: string,
  decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  comment?: string
) {
  const doc = assertTenant(await db.documentFile.findUnique({ where: { id: documentFileId } }), tenantId, "DocumentFile");
  if (doc.status === "SUPERSEDED") throw new Error("A superseded revision cannot be decided on.");
  if (decision !== "APPROVE" && !comment?.trim()) {
    throw new Error("A comment is required when requesting changes or rejecting.");
  }

  const approverSnapshot = await buildActorSnapshot(db, tenantId, approverId);
  const newStatus = decision === "APPROVE" ? "APPROVED" : decision === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : "REJECTED";

  const eventId = await db.$transaction(async (tx) => {
    await tx.documentApproval.create({
      data: {
        tenantId,
        documentFileId,
        approverId,
        approverSnapshot: JSON.stringify(approverSnapshot),
        decision,
        comment,
      },
    });

    await tx.documentFile.update({
      where: { id: documentFileId },
      data: {
        status: newStatus,
        ...(decision === "APPROVE" ? { approvedAt: new Date(), approvedById: approverId } : {}),
      },
    });

    // Keep the Document Passport's §14 lifecycle status (a distinct
    // vocabulary from this revision's own status) in sync when this
    // revision has been adopted into one — see documents-module.ts.
    if (doc.documentId) {
      await tx.document.update({
        where: { id: doc.documentId },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : decision === "REQUEST_CHANGES" ? "NEEDS_REVISION" : "REJECTED",
        },
      });
    }

    await tx.timelineEvent.create({
      data: {
        tenantId,
        entityType: "DocumentFile",
        entityId: documentFileId,
        eventType: `APPROVAL_${decision}`,
        actorId: approverId,
        metadata: comment ? JSON.stringify({ comment }) : undefined,
      },
    });

    if (decision !== "APPROVE") return null;

    return emitDomainEvent(
      tx,
      tenantId,
      "DocumentRevisionApproved",
      { documentFileId, name: doc.name, taskId: doc.taskId },
      {
        actorUserId: approverId,
        actorSnapshot: approverSnapshot,
        sourceModule: "Documents",
        sourceRecordId: documentFileId,
        projectId: doc.projectId ?? undefined,
      }
    );
  });

  if (eventId) await dispatchDomainEvents([eventId]);
}
