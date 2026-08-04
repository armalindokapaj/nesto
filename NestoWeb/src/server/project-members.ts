import "server-only";
import { db } from "@/lib/db";
import { requireTenantProject, requireTenantMember } from "@/lib/tenant";

// The tenant-wide pool an "Add Member" picker chooses from — everyone with
// an active CompanyMembership, not just this project's existing roster.
export async function listTenantMembersForPicker(tenantId: string) {
  const memberships = await db.companyMembership.findMany({
    where: { tenantId, accessMode: "STANDARD" },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { user: { displayName: "asc" } },
  });
  return memberships.map((m) => m.user);
}

export async function addProjectMember(
  tenantId: string,
  projectId: string,
  input: { userId: string; roleOnProject?: string }
) {
  await Promise.all([requireTenantProject(tenantId, projectId), requireTenantMember(tenantId, input.userId)]);
  return db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: input.userId } },
    create: { projectId, userId: input.userId, roleOnProject: input.roleOnProject },
    update: { roleOnProject: input.roleOnProject },
  });
}

export async function removeProjectMember(tenantId: string, projectId: string, userId: string) {
  await requireTenantProject(tenantId, projectId);
  await db.projectMember.delete({ where: { projectId_userId: { projectId, userId } } }).catch(() => null);
}
