import "server-only";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";

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
  const checksum = createHash("sha256").update(input.file.data).digest("hex");

  return db.projectPhoto.create({
    data: {
      tenantId,
      projectId: input.projectId,
      workPackageId: input.workPackageId,
      fileData: input.file.data,
      fileMimeType: input.file.mimeType,
      fileSize: input.file.size,
      checksum,
      caption: input.caption,
      uploadedById: input.uploadedById,
    },
  });
}
