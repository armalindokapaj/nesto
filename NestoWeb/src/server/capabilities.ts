import { db } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { CAPABILITY_KEYS, type CapabilityKey, roleHasCapabilityByDefault } from "@/lib/capabilities";

/**
 * Deny-by-default per §10 of the PRD, but layered on top of the existing
 * role grant rather than replacing it: an explicit, non-revoked grant always
 * wins; an explicit revocation (a grant row that was later revoked, or a
 * role that never had the capability and has no grant at all) always loses
 * — even for a role that would otherwise have it by default. This lets an
 * Owner narrow a specific person's authority without changing their role.
 */
export async function hasCapability(tenantId: string, userId: string, role: Role, key: CapabilityKey): Promise<boolean> {
  const grant = await db.userCapabilityGrant.findUnique({ where: { userId_capabilityKey: { userId, capabilityKey: key } } });
  if (grant) return grant.revokedAt === null;
  return roleHasCapabilityByDefault(role, key);
}

export async function listCapabilityGrants(tenantId: string) {
  return db.userCapabilityGrant.findMany({
    where: { tenantId },
    include: { user: true, grantedBy: true },
    orderBy: { grantedAt: "desc" },
  });
}

export async function grantCapability(tenantId: string, actorId: string, userId: string, key: CapabilityKey) {
  if (!CAPABILITY_KEYS.includes(key)) throw new Error(`Unknown capability key "${key}".`);
  return db.userCapabilityGrant.upsert({
    where: { userId_capabilityKey: { userId, capabilityKey: key } },
    create: { tenantId, userId, capabilityKey: key, grantedById: actorId },
    update: { revokedAt: null, grantedById: actorId, grantedAt: new Date() },
  });
}

export async function revokeCapability(tenantId: string, actorId: string, userId: string, key: CapabilityKey) {
  const existing = await db.userCapabilityGrant.findUnique({ where: { userId_capabilityKey: { userId, capabilityKey: key } } });
  if (!existing) {
    // No grant row yet for a role-default capability — create one, pre-revoked,
    // so the explicit deny is recorded and takes effect immediately.
    return db.userCapabilityGrant.create({ data: { tenantId, userId, capabilityKey: key, grantedById: actorId, revokedAt: new Date() } });
  }
  return db.userCapabilityGrant.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
}
