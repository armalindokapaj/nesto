"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createProjectRender, pinProjectRender } from "@/server/project-renders";

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
  return { data, mimeType: file.type || "application/octet-stream", size: file.size };
}

export type ActionState = { error: string } | undefined;

export async function uploadProjectRenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    return { error: "You do not have permission to manage this project's renders." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };

  let file;
  try {
    file = await readUploadedFile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid file" };
  }

  try {
    await createProjectRender(tenantId, {
      projectId,
      uploadedById: user.id,
      file,
      pin: formData.get("pin") === "on",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload render." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return undefined;
}

export async function pinProjectRenderAction(projectId: string, renderId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "WRITE")) {
    throw new Error("You do not have permission to manage this project's renders.");
  }
  await pinProjectRender(tenantId, projectId, renderId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
