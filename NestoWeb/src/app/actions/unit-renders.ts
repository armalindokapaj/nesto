"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { assertAllowedUpload, IMAGE_MIME_TYPES } from "@/lib/uploads";
import { canManageUnits } from "@/lib/unit-access";
import { createUnitRender, pinUnitRender } from "@/server/unit-renders";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function readUploadedFile(formData: FormData, field = "file") {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Attach an image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 8MB).");
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  // Phase 3 Track C — the declared type is attacker-controlled, so this checks
  // the bytes too, not just the allowlist.
  assertAllowedUpload(data, mimeType, IMAGE_MIME_TYPES, "render");
  return { data, mimeType, size: file.size };
}

export type ActionState = { error: string } | undefined;

export async function uploadUnitRenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to manage this unit's renders." };
  }

  const unitId = String(formData.get("unitId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!unitId) return { error: "Missing unit." };

  let file;
  try {
    file = await readUploadedFile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid file" };
  }

  try {
    await createUnitRender(tenantId, { unitId, uploadedById: user.id, file, pin: formData.get("pin") === "on" });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload render." };
  }

  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}/units`);
  return undefined;
}

export async function pinUnitRenderAction(projectId: string, unitId: string, renderId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!canManageUnits(role)) {
    throw new Error("You do not have permission to manage this unit's renders.");
  }
  await pinUnitRender(tenantId, unitId, renderId);
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}/units`);
}
