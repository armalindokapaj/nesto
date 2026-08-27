import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";
import { writeFileToStorage } from "@/lib/storage";

type UploadedFile = { data: Uint8Array<ArrayBuffer>; mimeType: string; size: number };

export async function listProjectPhotos(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  return db.projectPhoto.findMany({
    where: { tenantId, projectId },
    orderBy: { takenAt: "desc" },
    select: { id: true, caption: true, takenAt: true, uploadedBy: { select: { displayName: true } } },
  });
}

export async function createProjectPhoto(
  tenantId: string,
  input: { projectId: string; uploadedById: string; file: UploadedFile; caption?: string; workPackageId?: string }
) {
  await requireTenantProject(tenantId, input.projectId);
  if (input.workPackageId) {
    const wp = assertTenant(
      await db.projectWorkPackage.findUnique({ where: { id: input.workPackageId } }),
      tenantId,
      "ProjectWorkPackage"
    );
    if (wp.projectId !== input.projectId) throw new Error("Work package does not belong to this project.");
  }
  const id = randomUUID();
  const stored = await writeFileToStorage("projectPhoto", id, `photo-${id}`, input.file.data, input.file.mimeType);

  return db.projectPhoto.create({
    data: {
      id,
      tenantId,
      projectId: input.projectId,
      workPackageId: input.workPackageId,
      fileUrl: stored.url,
      fileMimeType: input.file.mimeType,
      fileSize: stored.size,
      checksum: stored.checksum,
      caption: input.caption,
      uploadedById: input.uploadedById,
    },
  });
}
