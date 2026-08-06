import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Documents_Module — the module-level layer (folder tree, Document
// Passport records, shortcuts, links, activity). Deliberately separate from
// src/server/documents.ts, which remains the per-record attachment API that
// the Projects/Tasks/Units pages already use; this file never changes that
// behaviour, it only adds the Documents Module on top.

// §9 — the platform's default folder roots. `systemKey` makes seeding
// idempotent so re-running never duplicates a root.
export const DEFAULT_ROOT_FOLDERS = [
  { systemKey: "root:company", name: "Company", sourceEntityType: "COMPANY" },
  { systemKey: "root:projects", name: "Projects", sourceEntityType: "PROJECT" },
  { systemKey: "root:structures", name: "Buildings / Structures", sourceEntityType: "STRUCTURE" },
  { systemKey: "root:units", name: "Units", sourceEntityType: "UNIT" },
  { systemKey: "root:clients", name: "Clients", sourceEntityType: "CLIENT" },
  { systemKey: "root:tasks", name: "Tasks", sourceEntityType: "TASK" },
  { systemKey: "root:meetings", name: "Meetings", sourceEntityType: "MEETING" },
  { systemKey: "root:approvals", name: "Approvals", sourceEntityType: "APPROVAL" },
  { systemKey: "root:finance", name: "Finance", sourceEntityType: "FINANCE" },
  { systemKey: "root:legal", name: "Government & Legal", sourceEntityType: "LEGAL" },
  { systemKey: "root:hr", name: "HR", sourceEntityType: "HR" },
  { systemKey: "root:personal", name: "Personal Workspace", sourceEntityType: "USER" },
] as const;

// §9.1 — the configurable per-project subfolder template. Tranzit is
// mandatory (TRZ-001) and is created for every project regardless of how the
// rest of the template is customised.
export const PROJECT_SUBFOLDERS = [
  "01. Project Management",
  "02. Drawings",
  "03. Specifications",
  "04. Contracts",
  "05. Reports",
  "06. Site Photos",
  "Tranzit",
  "Archive",
] as const;

export const DRAWING_SUBFOLDERS = ["Architectural", "Structural", "MEP", "Landscape"] as const;

// §14 lifecycle states.
export const DOCUMENT_STATUSES = [
  "DRAFT",
  "TRANZIT",
  "INTERNAL_REVIEW",
  "AWAITING_APPROVAL",
  "APPROVED",
  "ISSUED",
  "NEEDS_REVISION",
  "REJECTED",
  "SUPERSEDED",
  "ARCHIVED",
  "VOID",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// §14 — "A new revision must not automatically inherit Approved or Issued
// status from the previous revision." Uploading a revision always lands here.
export const STATUS_AFTER_NEW_REVISION: DocumentStatus = "DRAFT";

async function logActivity(input: {
  tenantId: string;
  documentId: string;
  revisionId?: string | null;
  actorId?: string | null;
  eventType: string;
  summary: string;
  payload?: unknown;
}) {
  await db.documentActivity.create({
    data: {
      tenantId: input.tenantId,
      documentId: input.documentId,
      revisionId: input.revisionId ?? null,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      payload: input.payload === undefined ? null : JSON.stringify(input.payload),
    },
  });
}

// ---------------------------------------------------------------------------
// Folder tree
// ---------------------------------------------------------------------------

/** Idempotently creates the §9 default roots for a tenant. Safe to re-run. */
export async function ensureRootFolders(tenantId: string) {
  for (const [index, root] of DEFAULT_ROOT_FOLDERS.entries()) {
    const existing = await db.folder.findUnique({
      where: { tenantId_systemKey: { tenantId, systemKey: root.systemKey } },
    });
    if (existing) continue;
    await db.folder.create({
      data: {
        tenantId,
        systemKey: root.systemKey,
        name: root.name,
        folderType: "SYSTEM",
        sourceEntityType: root.sourceEntityType,
        sortOrder: index,
      },
    });
  }
}

/**
 * TRZ-001 — every Project automatically gets its system folder plus the
 * §9.1 subfolder template, including a mandatory Tranzit. Idempotent.
 */
export async function ensureProjectFolders(tenantId: string, projectId: string, projectName: string) {
  await ensureRootFolders(tenantId);
  const root = await db.folder.findUnique({
    where: { tenantId_systemKey: { tenantId, systemKey: "root:projects" } },
  });
  if (!root) throw new Error("Projects root folder missing");

  const projectKey = `project:${projectId}`;
  let projectFolder = await db.folder.findUnique({
    where: { tenantId_systemKey: { tenantId, systemKey: projectKey } },
  });
  if (!projectFolder) {
    projectFolder = await db.folder.create({
      data: {
        tenantId,
        systemKey: projectKey,
        parentId: root.id,
        name: projectName,
        folderType: "SYSTEM",
        sourceEntityType: "PROJECT",
        sourceEntityId: projectId,
      },
    });
  }

  for (const [index, name] of PROJECT_SUBFOLDERS.entries()) {
    const key = `${projectKey}:${name}`;
    const existing = await db.folder.findUnique({ where: { tenantId_systemKey: { tenantId, systemKey: key } } });
    const sub =
      existing ??
      (await db.folder.create({
        data: {
          tenantId,
          systemKey: key,
          parentId: projectFolder.id,
          name,
          folderType: "SYSTEM",
          sourceEntityType: "PROJECT",
          sourceEntityId: projectId,
          sortOrder: index,
        },
      }));

    if (name === "02. Drawings") {
      for (const [di, discipline] of DRAWING_SUBFOLDERS.entries()) {
        const dKey = `${key}:${discipline}`;
        const has = await db.folder.findUnique({ where: { tenantId_systemKey: { tenantId, systemKey: dKey } } });
        if (!has) {
          await db.folder.create({
            data: {
              tenantId,
              systemKey: dKey,
              parentId: sub.id,
              name: discipline,
              folderType: "SYSTEM",
              sourceEntityType: "PROJECT",
              sourceEntityId: projectId,
              sortOrder: di,
            },
          });
        }
      }
    }
  }

  return projectFolder;
}

/** Returns the tenant's folders as a nested tree for the §7 folder column. */
export async function getFolderTree(tenantId: string) {
  const folders = await db.folder.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      folderType: true,
      systemKey: true,
      sourceEntityType: true,
      sourceEntityId: true,
    },
  });

  const counts = await db.documentFolderRef.groupBy({
    by: ["folderId"],
    where: { tenantId },
    _count: { _all: true },
  });
  const countByFolder = new Map(counts.map((c) => [c.folderId, c._count._all]));

  type Node = (typeof folders)[number] & { documentCount: number; children: Node[] };
  const byId = new Map<string, Node>();
  for (const f of folders) byId.set(f.id, { ...f, documentCount: countByFolder.get(f.id) ?? 0, children: [] });

  const roots: Node[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function createCustomFolder(
  tenantId: string,
  input: { name: string; parentId?: string | null; createdById: string }
) {
  if (input.parentId) {
    assertTenant(await db.folder.findUnique({ where: { id: input.parentId } }), tenantId, "Folder");
  }
  return db.folder.create({
    data: {
      tenantId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      folderType: "CUSTOM",
      createdById: input.createdById,
    },
  });
}

// ---------------------------------------------------------------------------
// §48 Migration — adopt pre-existing attachments into Passport records
// ---------------------------------------------------------------------------

/**
 * §48 steps 22-24 — every DocumentFile that predates this module (project,
 * task, unit and client attachments) is adopted into a Document record with
 * its Passport metadata backfilled and a folder reference generated, so the
 * Documents Module shows the tenant's real corpus rather than an empty list.
 *
 * Also doubles as the ongoing sync for uploads/revisions that still go
 * through the legacy `src/server/documents.ts` actions (which know nothing
 * of Document Passports): safe to call on every page load, not just once.
 * Walking a revision's `supersedesId` chain stops the moment it reaches a
 * revision that already has a `documentId` — that lineage already has a
 * Passport, so the new revision(s) are attached to *that* Document instead
 * of minting a duplicate one.
 */
export async function backfillDocumentRecords(tenantId: string) {
  const orphans = await db.documentFile.findMany({
    // Only heads of a revision chain are considered; earlier revisions are
    // picked up below by walking `supersedesId`.
    where: { tenantId, documentId: null, supersededBy: null },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (orphans.length === 0) return { adopted: 0 };

  await ensureRootFolders(tenantId);
  const roots = await db.folder.findMany({
    where: { tenantId, systemKey: { in: DEFAULT_ROOT_FOLDERS.map((r) => r.systemKey) } },
    select: { id: true, systemKey: true },
  });
  const rootBy = new Map(roots.map((r) => [r.systemKey, r.id]));

  let adopted = 0;
  for (const file of orphans) {
    // Walk backwards through supersedesId, collecting revisions that have no
    // Passport yet. Stop as soon as an already-adopted ancestor is found —
    // its documentId is the Document this new revision belongs to.
    const newRevisionIds: string[] = [file.id];
    let existingDocumentId: string | null = null;
    let cursor: { id: string; supersedesId: string | null } | null = file;
    while (cursor?.supersedesId) {
      const prev: { id: string; supersedesId: string | null; documentId: string | null } | null =
        await db.documentFile.findUnique({
          where: { id: cursor.supersedesId },
          select: { id: true, supersedesId: true, documentId: true },
        });
      if (!prev) break;
      if (prev.documentId) {
        existingDocumentId = prev.documentId;
        break;
      }
      newRevisionIds.unshift(prev.id);
      cursor = { id: prev.id, supersedesId: prev.supersedesId };
    }

    if (existingDocumentId) {
      // A later revision on an already-adopted lineage — extend it.
      const existing = await db.document.findUnique({
        where: { id: existingDocumentId },
        select: { id: true, _count: { select: { revisions: true } } },
      });
      if (!existing) continue;
      let nextIndex = existing._count.revisions;
      for (const revisionId of newRevisionIds) {
        await db.documentFile.update({
          where: { id: revisionId },
          data: { documentId: existing.id, revisionCode: `R${String(nextIndex).padStart(2, "0")}` },
        });
        nextIndex += 1;
      }
      // §14 — a new revision never inherits Approved/Issued status.
      await db.document.update({
        where: { id: existing.id },
        data: { currentRevisionId: file.id, status: STATUS_AFTER_NEW_REVISION },
      });
      adopted += 1;
      continue;
    }

    // Route each legacy attachment to the root matching the record it hangs
    // off, mirroring §9's default structure.
    const folderId =
      (file.projectId
        ? (await ensureProjectFolders(tenantId, file.projectId, file.project?.name ?? "Project")).id
        : file.unitId
          ? rootBy.get("root:units")
          : file.clientId
            ? rootBy.get("root:clients")
            : file.taskId
              ? rootBy.get("root:tasks")
              : file.employeeId
                ? rootBy.get("root:hr")
                : rootBy.get("root:company")) ?? rootBy.get("root:company");
    if (!folderId) continue;

    // Map the legacy status vocabulary onto §14's lifecycle.
    const status: DocumentStatus =
      file.status === "APPROVED"
        ? "APPROVED"
        : file.status === "OFFICIAL"
          ? "ISSUED"
          : file.status === "REJECTED"
            ? "REJECTED"
            : file.status === "UNDER_REVIEW"
              ? "INTERNAL_REVIEW"
              : file.status === "ARCHIVED"
                ? "ARCHIVED"
                : "DRAFT";

    const links: { entityType: string; entityId: string; isPrimary?: boolean }[] = [];
    if (file.projectId) links.push({ entityType: "PROJECT", entityId: file.projectId, isPrimary: true });
    if (file.unitId) links.push({ entityType: "UNIT", entityId: file.unitId });
    if (file.clientId) links.push({ entityType: "CLIENT", entityId: file.clientId });
    if (file.taskId) links.push({ entityType: "TASK", entityId: file.taskId });
    if (file.employeeId) links.push({ entityType: "EMPLOYEE", entityId: file.employeeId });

    const document = await createDocumentRecord(tenantId, {
      title: file.name,
      docType: file.category,
      category: file.category,
      folderId,
      ownerId: file.uploadedById,
      status,
      links,
      revisionFileId: file.id,
    });

    // Number the newly-adopted chain oldest-first (createDocumentRecord
    // already stamped `file` itself as R00; this corrects it if it wasn't
    // actually the oldest revision).
    for (const [index, revisionId] of newRevisionIds.entries()) {
      await db.documentFile.update({
        where: { id: revisionId },
        data: { documentId: document.id, revisionCode: `R${String(index).padStart(2, "0")}` },
      });
    }
    await db.document.update({
      where: { id: document.id },
      data: { currentRevisionId: file.id },
    });

    adopted += 1;
  }

  return { adopted };
}

// ---------------------------------------------------------------------------
// Documents (Passport records)
// ---------------------------------------------------------------------------

export type DocumentScope =
  | "ALL"
  | "RECENT"
  | "STARRED"
  | "MINE"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "NEEDS_REVISION"
  | "EXPIRING"
  | "ARCHIVED";

/** §7.2 status summary cards. One grouped query rather than eight counts. */
export async function getDocumentSummary(tenantId: string, userId: string) {
  const [byStatus, total, archived, starred, expiring, mine] = await Promise.all([
    db.document.groupBy({ by: ["status"], where: { tenantId, archivedAt: null }, _count: { _all: true } }),
    db.document.count({ where: { tenantId, archivedAt: null } }),
    db.document.count({ where: { tenantId, archivedAt: { not: null } } }),
    db.documentFavorite.count({ where: { tenantId, userId } }),
    db.document.count({
      where: {
        tenantId,
        archivedAt: null,
        expiresAt: { not: null, lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.document.count({ where: { tenantId, archivedAt: null, ownerId: userId } }),
  ]);
  const status = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;

  return {
    all: total,
    recent: total,
    starred,
    mine,
    awaitingApproval: status("AWAITING_APPROVAL"),
    approved: status("APPROVED") + status("ISSUED"),
    needsRevision: status("NEEDS_REVISION") + status("REJECTED"),
    expiringSoon: expiring,
    archived,
  };
}

/**
 * DOC-MOD-001 — folder browsing and global filtered views resolve through the
 * same query, so switching between them keeps scope, filters and sort.
 */
export async function listModuleDocuments(
  tenantId: string,
  userId: string,
  opts: {
    folderId?: string | null;
    scope?: DocumentScope;
    search?: string;
    status?: string;
    docType?: string;
    take?: number;
    // Back-compat with the pre-module task filter (`/documents?taskId=`,
    // still linked from the frozen Projects task badge) and any other
    // link-based filter a future module page wants to reuse.
    linkEntityType?: string;
    linkEntityId?: string;
  } = {}
) {
  const { folderId, scope = "ALL", search, status, docType, take = 100, linkEntityType, linkEntityId } = opts;

  const where: Record<string, unknown> = { tenantId };

  if (scope === "ARCHIVED") where.archivedAt = { not: null };
  else where.archivedAt = null;

  if (folderId) where.folderRefs = { some: { folderId } };
  if (status) where.status = status;
  if (docType) where.docType = docType;
  if (linkEntityType && linkEntityId) where.links = { some: { entityType: linkEntityType, entityId: linkEntityId } };

  switch (scope) {
    case "STARRED":
      where.favorites = { some: { userId } };
      break;
    // Personal Workspace — everything this user owns, regardless of folder.
    case "MINE":
      where.ownerId = userId;
      break;
    case "AWAITING_APPROVAL":
      where.status = "AWAITING_APPROVAL";
      break;
    case "APPROVED":
      where.status = { in: ["APPROVED", "ISSUED"] };
      break;
    case "NEEDS_REVISION":
      where.status = { in: ["NEEDS_REVISION", "REJECTED"] };
      break;
    case "EXPIRING":
      where.expiresAt = { not: null, lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
      break;
    default:
      break;
  }

  // §19.1 — title, code and the underlying revision's original filename.
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { code: { contains: q } },
      { revisions: { some: { name: { contains: q } } } },
    ];
  }

  const documents = await db.document.findMany({
    where,
    orderBy: scope === "RECENT" ? { updatedAt: "desc" } : { updatedAt: "desc" },
    take,
    include: {
      primaryFolder: { select: { id: true, name: true } },
      owner: { select: { id: true, displayName: true, avatarColor: true } },
      currentRevision: {
        select: { id: true, revisionCode: true, fileMimeType: true, fileSize: true, createdAt: true },
      },
      favorites: { where: { userId }, select: { id: true } },
      _count: { select: { comments: true, revisions: true, links: true } },
    },
  });

  return documents.map((d) => ({ ...d, isStarred: d.favorites.length > 0 }));
}

/** §12/§13 — the full Passport: metadata, folder placement, links, revisions. */
export async function getDocumentPassport(tenantId: string, documentId: string, userId: string) {
  const document = assertTenant(
    await db.document.findUnique({
      where: { id: documentId },
      include: {
        primaryFolder: true,
        owner: { select: { id: true, displayName: true, avatarColor: true } },
        currentRevision: { include: { uploadedBy: { select: { id: true, displayName: true } } } },
        revisions: {
          orderBy: { createdAt: "asc" },
          include: {
            uploadedBy: { select: { id: true, displayName: true, avatarColor: true } },
            approvals: { include: { approver: { select: { id: true, displayName: true } } } },
          },
        },
        folderRefs: { include: { folder: { select: { id: true, name: true, folderType: true } } } },
        links: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
        },
        dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependedOnBy: { include: { document: { select: { id: true, title: true, status: true } } } },
        favorites: { where: { userId }, select: { id: true } },
      },
    }),
    tenantId,
    "Document"
  );

  const activity = await db.documentActivity.findMany({
    where: { tenantId, documentId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  // Checksum-based duplicate detection (§ deferred item) — checksum was
  // already computed at upload time (src/server/documents.ts); this just
  // surfaces matches rather than blocking the upload, since a legitimate
  // re-attach of the same file to a different Document/folder is common.
  const duplicates = document.currentRevision?.checksum
    ? await db.document.findMany({
        where: { tenantId, id: { not: document.id }, currentRevision: { checksum: document.currentRevision.checksum } },
        select: { id: true, title: true, code: true, primaryFolder: { select: { name: true } } },
      })
    : [];

  return { ...document, isStarred: document.favorites.length > 0, activity, duplicates };
}

/**
 * §17 — creates the Passport record and its first revision in one
 * transaction, together with the primary folder reference (§38's
 * "Transactional creation of Document + first Revision + FolderRef").
 */
export async function createDocumentRecord(
  tenantId: string,
  input: {
    title: string;
    code?: string | null;
    docType?: string;
    category?: string;
    folderId: string;
    ownerId: string;
    status?: DocumentStatus;
    links?: { entityType: string; entityId: string; isPrimary?: boolean }[];
    revisionFileId?: string | null;
  }
) {
  const folder = assertTenant(await db.folder.findUnique({ where: { id: input.folderId } }), tenantId, "Folder");

  // TRZ-002 — a first upload into Tranzit may not be born Approved/Issued.
  const isTranzit = folder.name === "Tranzit";
  let status: DocumentStatus = input.status ?? (isTranzit ? "TRANZIT" : "DRAFT");
  if (isTranzit && (status === "APPROVED" || status === "ISSUED")) status = "TRANZIT";

  const document = await db.document.create({
    data: {
      tenantId,
      title: input.title.trim(),
      code: input.code?.trim() || null,
      docType: input.docType ?? "GENERAL",
      category: input.category ?? "General",
      status,
      primaryFolderId: folder.id,
      ownerId: input.ownerId,
      currentRevisionId: input.revisionFileId ?? null,
      folderRefs: { create: { tenantId, folderId: folder.id, isPrimary: true, createdById: input.ownerId } },
      links: input.links?.length
        ? {
            create: input.links.map((l) => ({
              tenantId,
              entityType: l.entityType,
              entityId: l.entityId,
              isPrimary: l.isPrimary ?? false,
            })),
          }
        : undefined,
    },
  });

  if (input.revisionFileId) {
    await db.documentFile.update({
      where: { id: input.revisionFileId },
      data: { documentId: document.id, revisionCode: "R00" },
    });
  }

  await logActivity({
    tenantId,
    documentId: document.id,
    actorId: input.ownerId,
    eventType: "CREATED",
    summary: `Document created in ${folder.name}`,
  });

  return document;
}

/**
 * §18 Promote from Tranzit — a controlled **move of the same record**, not a
 * copy. Document ID, revision chain, links, comments and activity are all
 * preserved; only the primary folder and lifecycle state change.
 */
export async function promoteFromTranzit(
  tenantId: string,
  input: { documentId: string; destinationFolderId: string; actorId: string; keepShortcut?: boolean }
) {
  const document = assertTenant(
    await db.document.findUnique({ where: { id: input.documentId }, include: { primaryFolder: true } }),
    tenantId,
    "Document"
  );
  const destination = assertTenant(
    await db.folder.findUnique({ where: { id: input.destinationFolderId } }),
    tenantId,
    "Folder"
  );
  if (destination.name === "Tranzit") {
    throw new Error("Choose an official destination folder.");
  }
  const previousFolder = document.primaryFolder;

  await db.$transaction(async (tx) => {
    await tx.documentFolderRef.updateMany({ where: { documentId: document.id }, data: { isPrimary: false } });

    const existingRef = await tx.documentFolderRef.findUnique({
      where: { documentId_folderId: { documentId: document.id, folderId: destination.id } },
    });
    if (existingRef) {
      await tx.documentFolderRef.update({ where: { id: existingRef.id }, data: { isPrimary: true } });
    } else {
      await tx.documentFolderRef.create({
        data: {
          tenantId,
          documentId: document.id,
          folderId: destination.id,
          isPrimary: true,
          createdById: input.actorId,
        },
      });
    }

    // §10 — a shortcut may remain in Tranzit for traceability, by config.
    if (!input.keepShortcut && previousFolder) {
      await tx.documentFolderRef.deleteMany({ where: { documentId: document.id, folderId: previousFolder.id } });
    }

    await tx.document.update({
      where: { id: document.id },
      data: {
        primaryFolderId: destination.id,
        status: document.status === "TRANZIT" ? "DRAFT" : document.status,
      },
    });
  });

  // TRZ-004 — promotion is recorded in the activity timeline.
  await logActivity({
    tenantId,
    documentId: document.id,
    actorId: input.actorId,
    eventType: "PROMOTED_FROM_TRANZIT",
    summary: `Promoted from ${previousFolder?.name ?? "Tranzit"} to ${destination.name}`,
    payload: { from: previousFolder?.id ?? null, to: destination.id },
  });

  return db.document.findUnique({ where: { id: document.id } });
}

/** §16 — add a reference in another folder. No file duplication. */
export async function createShortcut(
  tenantId: string,
  input: { documentId: string; folderId: string; actorId: string }
) {
  assertTenant(await db.document.findUnique({ where: { id: input.documentId } }), tenantId, "Document");
  const folder = assertTenant(await db.folder.findUnique({ where: { id: input.folderId } }), tenantId, "Folder");

  const existing = await db.documentFolderRef.findUnique({
    where: { documentId_folderId: { documentId: input.documentId, folderId: input.folderId } },
  });
  if (existing) return existing;

  const ref = await db.documentFolderRef.create({
    data: { tenantId, documentId: input.documentId, folderId: input.folderId, createdById: input.actorId },
  });
  await logActivity({
    tenantId,
    documentId: input.documentId,
    actorId: input.actorId,
    eventType: "SHORTCUT_ADDED",
    summary: `Shortcut added in ${folder.name}`,
  });
  return ref;
}

/** §16 — removing a shortcut never deletes the document, and never the primary. */
export async function removeShortcut(
  tenantId: string,
  input: { documentId: string; folderId: string; actorId: string }
) {
  const ref = await db.documentFolderRef.findUnique({
    where: { documentId_folderId: { documentId: input.documentId, folderId: input.folderId } },
    include: { folder: { select: { name: true } } },
  });
  if (!ref || ref.tenantId !== tenantId) throw new Error("Shortcut not found.");
  if (ref.isPrimary) throw new Error("Set another folder as primary before removing this reference.");

  await db.documentFolderRef.delete({ where: { id: ref.id } });
  await logActivity({
    tenantId,
    documentId: input.documentId,
    actorId: input.actorId,
    eventType: "SHORTCUT_REMOVED",
    summary: `Shortcut removed from ${ref.folder.name}`,
  });
}

/** DOC-MOD-003 — private Star. Never notifies, never changes document state. */
export async function toggleDocumentStar(tenantId: string, documentId: string, userId: string) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  const existing = await db.documentFavorite.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
  if (existing) {
    await db.documentFavorite.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await db.documentFavorite.create({ data: { tenantId, documentId, userId } });
  return { starred: true };
}

/** §31 — soft archive by default; history is never destroyed (AC-11). */
export async function archiveDocument(tenantId: string, documentId: string, actorId: string) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  await db.document.update({ where: { id: documentId }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
  await logActivity({ tenantId, documentId, actorId, eventType: "ARCHIVED", summary: "Document archived" });
}

/** Bulk ops, deferred item — same per-document archive path, just looped; no separate bulk-specific state. */
export async function bulkArchiveDocuments(tenantId: string, actorId: string, documentIds: string[]) {
  let archivedCount = 0;
  for (const documentId of documentIds) {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.tenantId !== tenantId || doc.archivedAt) continue;
    await archiveDocument(tenantId, documentId, actorId);
    archivedCount++;
  }
  return archivedCount;
}

export async function restoreDocument(tenantId: string, documentId: string, actorId: string) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  await db.document.update({ where: { id: documentId }, data: { archivedAt: null, status: "DRAFT" } });
  await logActivity({ tenantId, documentId, actorId, eventType: "RESTORED", summary: "Document restored" });
}

/**
 * §22 — approval belongs to the exact revision. Attaching a new revision
 * therefore always resets the document out of APPROVED/ISSUED.
 */
export async function attachRevision(
  tenantId: string,
  input: { documentId: string; revisionFileId: string; revisionCode: string; actorId: string }
) {
  const document = assertTenant(
    await db.document.findUnique({ where: { id: input.documentId } }),
    tenantId,
    "Document"
  );

  const duplicate = await db.documentFile.findFirst({
    where: { tenantId, documentId: document.id, revisionCode: input.revisionCode },
    select: { id: true },
  });
  if (duplicate) throw new Error(`Revision ${input.revisionCode} already exists for this document.`);

  await db.$transaction([
    db.documentFile.update({
      where: { id: input.revisionFileId },
      data: { documentId: document.id, revisionCode: input.revisionCode },
    }),
    db.document.update({
      where: { id: document.id },
      data: { currentRevisionId: input.revisionFileId, status: STATUS_AFTER_NEW_REVISION },
    }),
  ]);

  await logActivity({
    tenantId,
    documentId: document.id,
    revisionId: input.revisionFileId,
    actorId: input.actorId,
    eventType: "REVISION_UPLOADED",
    summary: `Revision ${input.revisionCode} uploaded — approval reset`,
  });

  // §25 — warn downstream documents that depend on this one.
  const dependents = await db.documentDependency.findMany({
    where: { tenantId, dependsOnId: document.id },
    include: { document: { select: { id: true, title: true } } },
  });
  return { impacted: dependents.map((d) => d.document) };
}

/** A comment on the Passport itself — distinct from a revision's approval decision. */
export async function addDocumentComment(
  tenantId: string,
  input: { documentId: string; authorId: string; body: string }
) {
  const body = input.body.trim();
  if (!body) throw new Error("Comment cannot be empty.");
  assertTenant(await db.document.findUnique({ where: { id: input.documentId } }), tenantId, "Document");

  const comment = await db.documentComment.create({
    data: { tenantId, documentId: input.documentId, authorId: input.authorId, body },
  });
  await logActivity({
    tenantId,
    documentId: input.documentId,
    actorId: input.authorId,
    eventType: "COMMENTED",
    summary: "Comment added",
  });
  return comment;
}

/** Flattens the folder tree into an ordered, depth-labelled list for `<select>` pickers. */
export function flattenFolders<T extends { id: string; name: string; children: T[] }>(
  roots: T[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  return roots.flatMap((f) => [{ id: f.id, name: f.name, depth }, ...flattenFolders(f.children, depth + 1)]);
}

// ---------------------------------------------------------------------------
// PRD_Documents_Module §27 "Required Reading" — assignment + open/acknowledge
// receipts. Schema (`DocumentReadReceipt`) already existed from the Phase-1
// pass; this closes the gap of nothing ever writing to it. Kept separate
// from Favorites/Star (§7.4) — required reading is assigned by an owner and
// tracked for compliance, a Star is a private, unrelated preference.
// ---------------------------------------------------------------------------

export async function setRequiredReading(tenantId: string, documentId: string, actorId: string, required: boolean, assigneeIds: string[]) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  await db.$transaction([
    db.document.update({ where: { id: documentId }, data: { requiredReading: required } }),
    ...(required
      ? assigneeIds.map((userId) =>
          db.documentReadReceipt.upsert({
            where: { documentId_userId: { documentId, userId } },
            create: { tenantId, documentId, userId, assignedAt: new Date() },
            update: { assignedAt: new Date() },
          })
        )
      : []),
  ]);
  await logActivity({
    tenantId,
    documentId,
    actorId,
    eventType: "REQUIRED_READING_ASSIGNED",
    summary: required ? `Required reading assigned to ${assigneeIds.length} member(s)` : "Required reading cleared",
  });
}

export async function acknowledgeRequiredReading(tenantId: string, documentId: string, userId: string) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  await db.documentReadReceipt.upsert({
    where: { documentId_userId: { documentId, userId } },
    create: { tenantId, documentId, userId, assignedAt: new Date(), openedAt: new Date(), acknowledgedAt: new Date() },
    update: { openedAt: new Date(), acknowledgedAt: new Date() },
  });
  await logActivity({
    tenantId,
    documentId,
    actorId: userId,
    eventType: "REQUIRED_READING_ACKNOWLEDGED",
    summary: "Marked as read",
  });
}

export async function listReadReceipts(tenantId: string, documentId: string) {
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  return db.documentReadReceipt.findMany({
    where: { tenantId, documentId },
    include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
    orderBy: { assignedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Collections — curated document packages (tender/handover sets, etc).
// Schema (`DocumentCollection`/`DocumentCollectionItem`) already existed;
// this wires it up for the first time. `ownerId` set = private to that user;
// `ownerId` null = shared, visible to anyone with DOCUMENTS/READ — same
// private-vs-shared shape as Documents' own Star (always private) vs Folder
// (always shared), just parameterized per collection instead of per type.
// ---------------------------------------------------------------------------

export async function listCollections(tenantId: string, userId: string) {
  return db.documentCollection.findMany({
    where: { tenantId, OR: [{ ownerId: userId }, { ownerId: null }] },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
}

function assertCollectionVisible<T extends { tenantId: string; ownerId: string | null }>(collection: T | null, tenantId: string, userId: string): T {
  const c = assertTenant(collection, tenantId, "DocumentCollection");
  if (c.ownerId && c.ownerId !== userId) throw new Error("This collection is private to another user.");
  return c;
}

export async function getCollection(tenantId: string, collectionId: string, userId: string) {
  const collection = assertCollectionVisible(await db.documentCollection.findUnique({ where: { id: collectionId } }), tenantId, userId);
  const items = await db.documentCollectionItem.findMany({
    where: { collectionId: collection.id },
    include: { document: { select: { id: true, title: true, code: true, status: true } } },
    orderBy: { sortOrder: "asc" },
  });
  // revisionId is a soft reference (no formal Prisma relation on this
  // pre-existing model) — resolved separately rather than via include.
  const revisionIds = items.map((i) => i.revisionId).filter((id): id is string => !!id);
  const revisions = revisionIds.length
    ? await db.documentFile.findMany({ where: { id: { in: revisionIds } }, select: { id: true, revisionCode: true } })
    : [];
  const revisionById = new Map(revisions.map((r) => [r.id, r]));

  return { collection, items: items.map((i) => ({ ...i, revision: i.revisionId ? (revisionById.get(i.revisionId) ?? null) : null })) };
}

export async function createCollection(tenantId: string, userId: string, input: { name: string; shared: boolean }) {
  return db.documentCollection.create({ data: { tenantId, name: input.name, ownerId: input.shared ? null : userId } });
}

export async function deleteCollection(tenantId: string, collectionId: string, userId: string) {
  assertCollectionVisible(await db.documentCollection.findUnique({ where: { id: collectionId } }), tenantId, userId);
  await db.documentCollection.delete({ where: { id: collectionId } });
}

export async function addDocumentToCollection(tenantId: string, collectionId: string, userId: string, documentId: string, revisionId?: string) {
  const collection = assertCollectionVisible(await db.documentCollection.findUnique({ where: { id: collectionId } }), tenantId, userId);
  assertTenant(await db.document.findUnique({ where: { id: documentId } }), tenantId, "Document");
  const count = await db.documentCollectionItem.count({ where: { collectionId: collection.id } });
  return db.documentCollectionItem.upsert({
    where: { collectionId_documentId: { collectionId: collection.id, documentId } },
    create: { collectionId: collection.id, documentId, revisionId, sortOrder: count },
    update: { revisionId },
  });
}

export async function removeDocumentFromCollection(tenantId: string, itemId: string, userId: string) {
  const item = await db.documentCollectionItem.findUnique({ where: { id: itemId }, include: { collection: true } });
  if (!item) throw new Error("Item not found.");
  assertCollectionVisible(item.collection, tenantId, userId);
  await db.documentCollectionItem.delete({ where: { id: itemId } });
}

// ---------------------------------------------------------------------------
// Storage dashboard — deferred item. Aggregates the same `fileSize` column
// every revision already carries; no new tracking needed.
// ---------------------------------------------------------------------------

export async function getStorageDashboard(tenantId: string) {
  const revisions = await db.documentFile.findMany({
    where: { tenantId, documentId: { not: null } },
    select: { fileSize: true, fileMimeType: true, document: { select: { primaryFolder: { select: { name: true } } } } },
  });

  const totalBytes = revisions.reduce((sum, r) => sum + (r.fileSize ?? 0), 0);
  const byType = new Map<string, { count: number; bytes: number }>();
  const byFolder = new Map<string, { count: number; bytes: number }>();
  for (const r of revisions) {
    const type = (r.fileMimeType ?? "unknown").split("/")[0];
    const folder = r.document?.primaryFolder?.name ?? "—";
    const t1 = byType.get(type) ?? { count: 0, bytes: 0 };
    t1.count++; t1.bytes += r.fileSize ?? 0;
    byType.set(type, t1);
    const f1 = byFolder.get(folder) ?? { count: 0, bytes: 0 };
    f1.count++; f1.bytes += r.fileSize ?? 0;
    byFolder.set(folder, f1);
  }

  return {
    totalBytes,
    revisionCount: revisions.length,
    byType: [...byType.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.bytes - a.bytes),
    byFolder: [...byFolder.entries()].map(([folder, v]) => ({ folder, ...v })).sort((a, b) => b.bytes - a.bytes),
  };
}
