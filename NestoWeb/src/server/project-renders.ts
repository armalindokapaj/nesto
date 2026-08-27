import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";
import { writeFileToStorage } from "@/lib/storage";

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
  const id = randomUUID();
  const stored = await writeFileToStorage("projectRender", id, `render-${id}`, input.file.data, input.file.mimeType);

  const render = await db.projectRender.create({
    data: {
      id,
      tenantId,
      projectId: input.projectId,
      fileUrl: stored.url,
      fileMimeType: input.file.mimeType,
      fileSize: stored.size,
      checksum: stored.checksum,
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
