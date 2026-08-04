import "server-only";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject, requireTenantContractor } from "@/lib/tenant";

export async function listProjectWorkPackages(tenantId: string, projectId: string) {
  await requireTenantProject(tenantId, projectId);
  return db.projectWorkPackage.findMany({
    where: { tenantId, projectId },
    orderBy: { createdAt: "desc" },
    include: { contractor: { select: { id: true, name: true } }, createdBy: { select: { displayName: true } } },
  });
}

export async function createProjectWorkPackage(
  tenantId: string,
  input: {
    projectId: string;
    createdById: string;
    name: string;
    area?: string;
    contractorId?: string;
    startDate?: Date;
    expectedFinishDate?: Date;
    latestUpdate?: string;
  }
) {
  await Promise.all([
    requireTenantProject(tenantId, input.projectId),
    input.contractorId ? requireTenantContractor(tenantId, input.contractorId) : null,
  ]);
  return db.projectWorkPackage.create({
    data: {
      tenantId,
      projectId: input.projectId,
      createdById: input.createdById,
      name: input.name,
      area: input.area,
      contractorId: input.contractorId,
      startDate: input.startDate,
      expectedFinishDate: input.expectedFinishDate,
      latestUpdate: input.latestUpdate,
    },
  });
}

export async function updateProjectWorkPackageProgress(
  tenantId: string,
  workPackageId: string,
  input: { status?: string; progressPct?: number; latestUpdate?: string }
) {
  const wp = assertTenant(await db.projectWorkPackage.findUnique({ where: { id: workPackageId } }), tenantId, "ProjectWorkPackage");
  return db.projectWorkPackage.update({ where: { id: wp.id }, data: input });
}
