"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { assertAllowedUpload, IMAGE_MIME_TYPES } from "@/lib/uploads";
import { can } from "@/lib/permissions";
import { createProjectPhoto } from "@/server/project-photos";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function readUploadedFile(formData: FormData, field = "file") {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Attach a photo.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 8MB).");
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  // Phase 3 Track C — the declared type is attacker-controlled, so this checks
  // the bytes too, not just the allowlist.
  assertAllowedUpload(data, mimeType, IMAGE_MIME_TYPES, "photo");
  return { data, mimeType, size: file.size };
}

export type ActionState = { error: string } | undefined;

export async function uploadProjectPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to upload photos." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };

  let file;
  try {
    file = await readUploadedFile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid file" };
  }

  const caption = String(formData.get("caption") ?? "").trim() || undefined;
  const workPackageId = String(formData.get("workPackageId") ?? "").trim() || undefined;

  try {
    await createProjectPhoto(tenantId, { projectId, uploadedById: user.id, file, caption, workPackageId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload photo." };
  }

  revalidatePath(`/projects/${projectId}`);
  return undefined;
}
