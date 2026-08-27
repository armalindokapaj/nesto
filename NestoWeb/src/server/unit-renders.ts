import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { writeFileToStorage } from "@/lib/storage";

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
  const id = randomUUID();
  const stored = await writeFileToStorage("unitRender", id, `render-${id}`, input.file.data, input.file.mimeType);

  const render = await db.unitRender.create({
    data: {
      id,
      tenantId,
      unitId: unit.id,
      fileUrl: stored.url,
      fileMimeType: input.file.mimeType,
      fileSize: stored.size,
      checksum: stored.checksum,
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
