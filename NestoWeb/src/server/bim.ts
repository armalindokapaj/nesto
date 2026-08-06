import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";

// PRD_BIM_3D_Digital_Twin — adapted Phase-1 (registry/metadata only, see the
// schema comment above BimModel). Gated on the PROJECTS resource, same
// "reuse an existing bucket rather than grow RESOURCES" pattern used by
// Assets/Work Progress.

export async function listBimModels(tenantId: string) {
  return db.bimModel.findMany({
    where: { tenantId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 }, _count: { select: { links: true, versions: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBimModel(tenantId: string, id: string) {
  const model = await db.bimModel.findUnique({
    where: { id },
    include: {
      versions: { include: { uploadedBy: { select: { displayName: true } } }, orderBy: { versionNumber: "desc" } },
      links: { include: { createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  return assertTenant(model, tenantId, "BimModel");
}

export async function registerBimModel(tenantId: string, actorId: string, input: { projectId: string; name: string; discipline?: string; description?: string }) {
  await requireTenantProject(tenantId, input.projectId);
  return db.bimModel.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function setBimModelStatus(tenantId: string, modelId: string, status: string) {
  const model = assertTenant(await db.bimModel.findUnique({ where: { id: modelId } }), tenantId, "BimModel");
  return db.bimModel.update({ where: { id: model.id }, data: { status } });
}

// Version numbers increment per model, never reused — same immutable-
// revision-chain rule as WorkProgressUpdate/SupplierDocument/DocumentFile.
export async function addBimModelVersion(tenantId: string, actorId: string, input: { modelId: string; documentId?: string; fileName?: string; notes?: string }) {
  const model = assertTenant(await db.bimModel.findUnique({ where: { id: input.modelId } }), tenantId, "BimModel");
  const last = await db.bimModelVersion.findFirst({ where: { modelId: model.id }, orderBy: { versionNumber: "desc" } });
  const { modelId: _modelId, ...rest } = input;
  const version = await db.bimModelVersion.create({
    data: { tenantId, modelId: model.id, versionNumber: (last?.versionNumber ?? 0) + 1, uploadedById: actorId, ...rest },
  });
  await db.bimModel.update({ where: { id: model.id }, data: { status: "DRAFT" } });
  return version;
}

export async function createBimObjectLink(tenantId: string, actorId: string, input: { modelId: string; objectRef?: string; entityType: string; entityId: string; relation?: string }) {
  const model = assertTenant(await db.bimModel.findUnique({ where: { id: input.modelId } }), tenantId, "BimModel");
  const { modelId: _modelId, ...rest } = input;
  return db.bimObjectLink.create({ data: { tenantId, createdById: actorId, modelId: model.id, ...rest } });
}

export async function removeBimObjectLink(tenantId: string, linkId: string) {
  const link = assertTenant(await db.bimObjectLink.findUnique({ where: { id: linkId } }), tenantId, "BimObjectLink");
  await db.bimObjectLink.delete({ where: { id: link.id } });
}

export async function listBimObjectLinksForEntity(tenantId: string, entityType: string, entityId: string) {
  return db.bimObjectLink.findMany({ where: { tenantId, entityType, entityId }, include: { model: { select: { id: true, name: true, discipline: true } } }, orderBy: { createdAt: "desc" } });
}
