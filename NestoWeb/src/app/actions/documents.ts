"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { assertAllowedUpload, DOCUMENT_MIME_TYPES } from "@/lib/uploads";
import { can } from "@/lib/permissions";
import {
  createDocument,
  uploadDocumentRevision,
  requestDocumentApproval,
  decideDocumentApproval,
} from "@/server/documents";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function readUploadedFile(formData: FormData, field = "file") {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Attach a file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 8MB).");
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  // Phase 3 Track C — the declared type is attacker-controlled, so this checks
  // the bytes too, not just the allowlist.
  assertAllowedUpload(data, mimeType, DOCUMENT_MIME_TYPES, "file");
  return { data, mimeType, size: file.size };
}

const CreateDocumentSchema = z.object({
  name: z.string().min(2, "Enter a document name"),
  category: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  taskId: z.string().optional(),
  unitId: z.string().optional(),
});

export type CreateDocumentState = { error: string } | undefined;

export async function createDocumentAction(_prev: CreateDocumentState, formData: FormData): Promise<CreateDocumentState> {
  const { tenantId, role, user } = await getCurrentUser();

  const parsed = CreateDocumentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    projectId: formData.get("projectId") || undefined,
    clientId: formData.get("clientId") || undefined,
    taskId: formData.get("taskId") || undefined,
    unitId: formData.get("unitId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // A document attached to a client (contract, floor plan, ...) is gated by
  // CLIENTS access; a task-attached file (PRD_4 §8) by TASKS access;
  // everything else (including unit-attached, PRD_Unit_Page §11) by PROJECTS
  // access. Uploading itself additionally needs DOCUMENTS write access
  // (PRD_18 §16).
  const authorized =
    (parsed.data.clientId ? can(role, "CLIENTS", "WRITE") : parsed.data.taskId ? can(role, "TASKS", "WRITE") : can(role, "PROJECTS", "WRITE")) &&
    can(role, "DOCUMENTS", "WRITE");
  if (!authorized) {
    return { error: "You do not have permission to add documents." };
  }

  let file;
  try {
    file = await readUploadedFile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid file" };
  }

  const doc = await createDocument(tenantId, { ...parsed.data, uploadedById: user.id, file });
  revalidatePath("/documents");
  if (parsed.data.clientId) revalidatePath(`/clients/${parsed.data.clientId}`);
  if (parsed.data.taskId) revalidatePath(`/tasks/${parsed.data.taskId}`);
  if (parsed.data.unitId && parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}/units/${parsed.data.unitId}`);
  return doc ? undefined : { error: "Could not create document." };
}

export type ActionState = { error: string } | undefined;

export async function uploadDocumentRevisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "WRITE")) {
    return { error: "You do not have permission to upload documents." };
  }

  const supersedesId = String(formData.get("supersedesId") ?? "");
  const revisionComment = String(formData.get("revisionComment") ?? "").trim();
  if (!supersedesId) return { error: "Missing document." };
  if (!revisionComment) return { error: "Explain what changed in this revision." };

  let file;
  try {
    file = await readUploadedFile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid file" };
  }

  try {
    await uploadDocumentRevision(tenantId, { supersedesId, revisionComment, uploadedById: user.id, file });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload revision." };
  }
  revalidatePath(`/documents/${supersedesId}`);
  revalidatePath("/documents");
  return undefined;
}

export async function requestDocumentApprovalAction(documentFileId: string, requestedApproverId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "WRITE")) {
    throw new Error("You do not have permission to request document approval.");
  }
  await requestDocumentApproval(tenantId, documentFileId, requestedApproverId, user.id);
  revalidatePath(`/documents/${documentFileId}`);
}

export async function decideDocumentApprovalAction(
  documentFileId: string,
  decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  comment?: string
) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "FULL")) {
    throw new Error("You do not have approval authority for documents.");
  }
  await decideDocumentApproval(tenantId, documentFileId, user.id, decision, comment);
  revalidatePath(`/documents/${documentFileId}`);
  revalidatePath("/documents");
}
