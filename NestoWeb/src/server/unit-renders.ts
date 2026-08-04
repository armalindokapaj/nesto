import "server-only";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// Mirrors src/server/project-renders.ts exactly, scoped to a Unit instead of
// a Project — same Brand Kit gallery pattern (PRD_Unit_Page §11 "one may be
// pinned as unit thumbnail").
type UploadedFile = { data: Uint8Array<ArrayBuffer>; mimeType: string; size: number };

export async function listUnitRenders(tenantId: string, unitId: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  return db.unitRender.findMany({
    where: { tenantId, unitId: unit.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileMimeType: true, createdAt: true, uploadedBy: { select: { displayName: true } } },
  });
}

export async function createUnitRender(
  tenantId: string,
  input: { unitId: string; uploadedById: string; file: UploadedFile; pin?: boolean }
) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");
  const checksum = createHash("sha256").update(input.file.data).digest("hex");

  const render = await db.unitRender.create({
    data: {
      tenantId,
      unitId: unit.id,
      fileData: input.file.data,
      fileMimeType: input.file.mimeType,
      fileSize: input.file.size,
      checksum,
      uploadedById: input.uploadedById,
    },
  });

  if (input.pin) {
    await db.unit.update({ where: { id: unit.id }, data: { pinnedRenderId: render.id } });
  }

  return render;
}

export async function pinUnitRender(tenantId: string, unitId: string, renderId: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const render = assertTenant(await db.unitRender.findUnique({ where: { id: renderId } }), tenantId, "UnitRender");
  if (render.unitId !== unit.id) {
    throw new Error("Render does not belong to this unit.");
  }
  return db.unit.update({ where: { id: unit.id }, data: { pinnedRenderId: renderId } });
}
