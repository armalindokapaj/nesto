import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Client_Supplier_Portals — Phase 1 "Shared foundation" only. See the
// schema comment above ExternalOrganization for the scope decision (reuses
// the existing CLIENT/CONTRACTOR UserIdentity login rather than a second
// external-facing auth system).

export async function listExternalOrganizations(tenantId: string) {
  const orgs = await db.externalOrganization.findMany({
    where: { tenantId },
    include: {
      memberships: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, displayName: true } } } },
      accessGrants: { where: { revokedAt: null }, include: { project: { select: { id: true, name: true, code: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return orgs;
}

export async function createExternalOrganization(
  tenantId: string,
  actorId: string,
  input: { name: string; orgType: string; linkedClientId?: string; linkedSupplierId?: string }
) {
  return db.externalOrganization.create({ data: { tenantId, createdById: actorId, ...input } });
}

// ---------------------------------------------------------------------------
// Membership — who (which existing CLIENT/CONTRACTOR user) belongs to the org.
// ---------------------------------------------------------------------------

export async function addPortalMember(tenantId: string, actorId: string, externalOrgId: string, userId: string, portalRole = "MEMBER") {
  const org = assertTenant(await db.externalOrganization.findUnique({ where: { id: externalOrgId } }), tenantId, "ExternalOrganization");
  return db.portalMembership.upsert({
    where: { externalOrgId_userId: { externalOrgId: org.id, userId } },
    create: { tenantId, externalOrgId: org.id, userId, portalRole, addedById: actorId },
    update: { status: "ACTIVE", portalRole },
  });
}

export async function removePortalMember(tenantId: string, membershipId: string) {
  const membership = assertTenant(await db.portalMembership.findUnique({ where: { id: membershipId } }), tenantId, "PortalMembership");
  return db.portalMembership.update({ where: { id: membership.id }, data: { status: "REMOVED" } });
}

// ---------------------------------------------------------------------------
// Project access — which projects the external org (and so its members) can see.
// ---------------------------------------------------------------------------

export async function grantProjectAccess(tenantId: string, actorId: string, externalOrgId: string, projectId: string) {
  const org = assertTenant(await db.externalOrganization.findUnique({ where: { id: externalOrgId } }), tenantId, "ExternalOrganization");
  const project = assertTenant(await db.project.findUnique({ where: { id: projectId } }), tenantId, "Project");
  return db.businessAccessRelationship.upsert({
    where: { externalOrgId_projectId: { externalOrgId: org.id, projectId: project.id } },
    create: { tenantId, externalOrgId: org.id, projectId: project.id, grantedById: actorId },
    update: { revokedAt: null, grantedById: actorId, grantedAt: new Date() },
  });
}

export async function revokeProjectAccess(tenantId: string, accessId: string) {
  const access = assertTenant(await db.businessAccessRelationship.findUnique({ where: { id: accessId } }), tenantId, "BusinessAccessRelationship");
  return db.businessAccessRelationship.update({ where: { id: access.id }, data: { revokedAt: new Date() } });
}

/**
 * Project IDs a given external-portal user (CLIENT/CONTRACTOR login) can see, via their org's grants.
 *
 * Phase 6 — use this result inside the query (`where: { projectId: { in: ids } }`),
 * never as a post-fetch `.filter()` on rows the database has already paged.
 * Filtering after LIMIT/OFFSET is wrong in a way that looks like an empty page:
 * a client with access to 3 of 200 tasks whose rows fall beyond the first page
 * boundary gets zero results on page 1, and any total/pageCount counted over
 * the whole tenant is wrong too. That is the expected outcome for almost every
 * real external user, not an edge case, since they see a small subset by
 * definition.
 */
export async function listAccessibleProjectIdsForUser(tenantId: string, userId: string) {
  const memberships = await db.portalMembership.findMany({
    where: { tenantId, userId, status: "ACTIVE" },
    select: { externalOrgId: true },
  });
  if (memberships.length === 0) return [];
  const grants = await db.businessAccessRelationship.findMany({
    where: { tenantId, externalOrgId: { in: memberships.map((m) => m.externalOrgId) }, revokedAt: null },
    select: { projectId: true },
  });
  return [...new Set(grants.map((g) => g.projectId))];
}
