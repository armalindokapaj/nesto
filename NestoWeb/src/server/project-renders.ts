import "server-only";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";

// Uint8Array<ArrayBuffer> (not Node's Buffer) — matches what Prisma's `Bytes`
// scalar expects and what `file.arrayBuffer()` naturally produces, same
// convention as src/server/documents.ts.
type UploadedFile = { data: Uint8Array<ArrayBuffer>; mimeType: string; size: number };

export async function listProjectRenders(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  return db.projectRender.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileMimeType: true, createdAt: true, uploadedBy: { select: { displayName: true } } },
  });
}

// PRD_Rework_1 §4/§6 — the render a user pins in the gallery becomes both the
// Project Page cover image and the universal thumbnail everywhere at once
// (Project.pinnedRenderId), so uploading with `pin: true` is the common case
// (e.g. the very first render for a project).
export async function createProjectRender(
  tenantId: string,
  input: { projectId: string; uploadedById: string; file: UploadedFile; pin?: boolean }
) {
  await requireTenantProject(tenantId, input.projectId);
  const checksum = createHash("sha256").update(input.file.data).digest("hex");

  const render = await db.projectRender.create({
    data: {
      tenantId,
      projectId: input.projectId,
      fileData: input.file.data,
      fileMimeType: input.file.mimeType,
      fileSize: input.file.size,
      checksum,
      uploadedById: input.uploadedById,
    },
  });

  if (input.pin) {
    await db.project.update({ where: { id: input.projectId }, data: { pinnedRenderId: render.id } });
  }

  return render;
}

export async function pinProjectRender(tenantId: string, projectId: string, renderId: string) {
  await requireTenantProject(tenantId, projectId);
  const render = assertTenant(await db.projectRender.findUnique({ where: { id: renderId } }), tenantId, "ProjectRender");
  if (render.projectId !== projectId) {
    throw new Error("Render does not belong to this project.");
  }
  return db.project.update({ where: { id: projectId }, data: { pinnedRenderId: renderId } });
}
