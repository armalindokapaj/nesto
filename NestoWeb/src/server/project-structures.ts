import "server-only";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";

export async function listProjectStructures(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  return db.projectStructure.findMany({
    where: { tenantId, projectId },
    orderBy: { order: "asc" },
    include: { floors: { orderBy: { order: "asc" } } },
  });
}

export async function createProjectStructure(
  tenantId: string,
  input: { projectId: string; name: string; kind?: string; order?: number }
) {
  await requireTenantProject(tenantId, input.projectId);
  return db.projectStructure.create({
    data: {
      tenantId,
      projectId: input.projectId,
      name: input.name,
      kind: input.kind ?? "BUILDING",
      order: input.order ?? 0,
    },
  });
}

export async function requireTenantStructure(tenantId: string, structureId: string) {
  const structure = await db.projectStructure.findUnique({ where: { id: structureId }, select: { tenantId: true } });
  assertTenant(structure, tenantId, "ProjectStructure");
}

export async function createProjectFloor(tenantId: string, input: { structureId: string; label: string; level: number; order?: number }) {
  await requireTenantStructure(tenantId, input.structureId);
  return db.projectFloor.create({
    data: {
      tenantId,
      structureId: input.structureId,
      label: input.label,
      level: input.level,
      order: input.order ?? input.level,
    },
  });
}

export async function requireTenantFloor(tenantId: string, floorId: string) {
  const floor = await db.projectFloor.findUnique({ where: { id: floorId }, select: { tenantId: true, structureId: true } });
  assertTenant(floor, tenantId, "ProjectFloor");
  return floor!;
}
