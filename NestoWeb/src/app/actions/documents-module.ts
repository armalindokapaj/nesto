"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createCustomFolder,
  createShortcut,
  removeShortcut,
  toggleDocumentStar,
  promoteFromTranzit,
  archiveDocument,
  restoreDocument,
  addDocumentComment,
  setRequiredReading,
  acknowledgeRequiredReading,
  createCollection,
  deleteCollection,
  addDocumentToCollection,
  removeDocumentFromCollection,
} from "@/server/documents-module";

// PRD_Documents_Module — module-level actions (folders, shortcuts, Star,
// Tranzit promotion, archive/restore). Document upload/revision continues to
// run through the existing src/app/actions/documents.ts entry points.

type ActionState = { error: string } | { ok: true } | undefined;

function assertDocumentsWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "DOCUMENTS", "WRITE")) throw new Error("Not authorized");
}

const CreateFolderSchema = z.object({
  name: z.string().min(1, "Enter a folder name"),
  parentId: z.string().optional(),
});

export async function createFolderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateFolderSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertDocumentsWrite(role);
    await createCustomFolder(tenantId, {
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
      createdById: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create folder" };
  }

  revalidatePath("/documents");
  return { ok: true };
}

export async function toggleDocumentStarAction(documentId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  // Starring is a private, read-side preference — READ access is enough.
  if (!can(role, "DOCUMENTS", "READ")) throw new Error("Not authorized");
  const result = await toggleDocumentStar(tenantId, documentId, user.id);
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  return result;
}

const ShortcutSchema = z.object({
  documentId: z.string().min(1),
  folderId: z.string().min(1),
});

export async function createShortcutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = ShortcutSchema.safeParse({
    documentId: formData.get("documentId"),
    folderId: formData.get("folderId"),
  });
  if (!parsed.success) return { error: "Select a destination folder." };

  try {
    assertDocumentsWrite(role);
    await createShortcut(tenantId, { ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create shortcut" };
  }

  revalidatePath(`/documents/${parsed.data.documentId}`);
  revalidatePath("/documents");
  return { ok: true };
}

export async function removeShortcutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = ShortcutSchema.safeParse({
    documentId: formData.get("documentId"),
    folderId: formData.get("folderId"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    assertDocumentsWrite(role);
    await removeShortcut(tenantId, { ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove shortcut" };
  }

  revalidatePath(`/documents/${parsed.data.documentId}`);
  return { ok: true };
}

const PromoteSchema = z.object({
  documentId: z.string().min(1),
  destinationFolderId: z.string().min(1, "Choose a destination folder"),
  keepShortcut: z.boolean().optional(),
});

export async function promoteFromTranzitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = PromoteSchema.safeParse({
    documentId: formData.get("documentId"),
    destinationFolderId: formData.get("destinationFolderId"),
    keepShortcut: formData.get("keepShortcut") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertDocumentsWrite(role);
    await promoteFromTranzit(tenantId, {
      documentId: parsed.data.documentId,
      destinationFolderId: parsed.data.destinationFolderId,
      keepShortcut: parsed.data.keepShortcut,
      actorId: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not promote document" };
  }

  revalidatePath(`/documents/${parsed.data.documentId}`);
  revalidatePath("/documents");
  return { ok: true };
}

export async function archiveDocumentAction(documentId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertDocumentsWrite(role);
  await archiveDocument(tenantId, documentId, user.id);
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
}

export async function restoreDocumentAction(documentId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertDocumentsWrite(role);
  await restoreDocument(tenantId, documentId, user.id);
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
}

const CommentSchema = z.object({
  documentId: z.string().min(1),
  body: z.string().min(1, "Write a comment first"),
});

export async function addDocumentCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CommentSchema.safeParse({
    documentId: formData.get("documentId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    // A comment is discussion, not a controlled change — READ access is enough.
    if (!can(role, "DOCUMENTS", "READ")) throw new Error("Not authorized");
    await addDocumentComment(tenantId, { documentId: parsed.data.documentId, authorId: user.id, body: parsed.data.body });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add comment" };
  }

  revalidatePath(`/documents/${parsed.data.documentId}`);
  return { ok: true };
}

const SetRequiredReadingSchema = z.object({
  documentId: z.string().min(1),
  required: z.coerce.boolean(),
  assigneeIds: z.array(z.string()).default([]),
});

export async function setRequiredReadingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = SetRequiredReadingSchema.safeParse({
    documentId: formData.get("documentId"),
    required: formData.get("required") === "on",
    assigneeIds: formData.getAll("assigneeIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertDocumentsWrite(role);
    await setRequiredReading(tenantId, parsed.data.documentId, user.id, parsed.data.required, parsed.data.assigneeIds);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update required reading" };
  }
  revalidatePath(`/documents/${parsed.data.documentId}`);
  return { ok: true };
}

export async function acknowledgeRequiredReadingAction(documentId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) throw new Error("Not authorized");
  await acknowledgeRequiredReading(tenantId, documentId, user.id);
  revalidatePath(`/documents/${documentId}`);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const CreateCollectionSchema = z.object({
  name: z.string().min(1, "Enter a collection name"),
  shared: z.coerce.boolean(),
});

export async function createCollectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) return { error: "Not authorized" };
  const parsed = CreateCollectionSchema.safeParse({ name: formData.get("name"), shared: formData.get("shared") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createCollection(tenantId, user.id, parsed.data);
  revalidatePath("/documents/collections");
  return { ok: true };
}

export async function deleteCollectionAction(collectionId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) throw new Error("Not authorized");
  await deleteCollection(tenantId, collectionId, user.id);
  revalidatePath("/documents/collections");
}

const AddToCollectionSchema = z.object({
  collectionId: z.string().min(1),
  documentId: z.string().min(1, "Select a document"),
  revisionId: z.string().optional(),
});

export async function addDocumentToCollectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) return { error: "Not authorized" };
  const parsed = AddToCollectionSchema.safeParse({
    collectionId: formData.get("collectionId"),
    documentId: formData.get("documentId"),
    revisionId: formData.get("revisionId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await addDocumentToCollection(tenantId, parsed.data.collectionId, user.id, parsed.data.documentId, parsed.data.revisionId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add document" };
  }
  revalidatePath(`/documents/collections/${parsed.data.collectionId}`);
  return { ok: true };
}

export async function removeDocumentFromCollectionAction(itemId: string, collectionId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) throw new Error("Not authorized");
  await removeDocumentFromCollection(tenantId, itemId, user.id);
  revalidatePath(`/documents/collections/${collectionId}`);
}
