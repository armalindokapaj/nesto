import { db } from "@/lib/db";
import { ROLES, ASSIGNABLE_ACCESS_MODES } from "@/lib/constants";
import type { AssignableAccessMode } from "@/lib/constants";

export async function getAdminDashboardData(tenantId: string) {
  const [memberships, pendingInvitations, projectCount, roleCounts, recentAudit] = await Promise.all([
    db.companyMembership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.invitation.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { invitedAt: "desc" },
    }),
    db.project.count({ where: { tenantId, status: { not: "ARCHIVED" } } }),
    db.companyMembership.groupBy({
      by: ["role"],
      where: { tenantId },
      _count: { role: true },
    }),
    db.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalUsers = memberships.length;
  const architectCount = roleCounts.find((r) => r.role === "ARCHITECT")?._count.role ?? 0;

  const roleBreakdown = ROLES.map((role) => ({
    label: role,
    value: roleCounts.find((r) => r.role === role)?._count.role ?? 0,
  })).filter((r) => r.value > 0);

  return {
    totalUsers,
    architectCount,
    projectCount,
    pendingInvitations,
    recentMembers: memberships.slice(0, 5),
    roleBreakdown,
    recentAudit,
  };
}

export async function listAllMembers(tenantId: string) {
  return db.companyMembership.findMany({
    where: { tenantId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Just enough to fill a member picker. listAllMembers() includes the entire
 * UserIdentity row per membership — password hash, contact details and all —
 * for pages that only ever render a name.
 */
export async function listMembersForPicker(tenantId: string) {
  return db.companyMembership.findMany({
    where: { tenantId },
    select: { role: true, user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllInvitations(tenantId: string) {
  return db.invitation.findMany({ where: { tenantId }, orderBy: { invitedAt: "desc" } });
}

export async function listTeams(tenantId: string) {
  // PRD_Teams_Module — archived teams stay in the database (history is
  // never destroyed) but drop out of the default working list.
  return db.team.findMany({
    where: { tenantId, archivedAt: null },
    include: { members: { include: { user: true } }, lead: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAuditEvents(tenantId: string, limit = 100) {
  return db.auditEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function getNotificationChannelSummary(tenantId: string) {
  const memberships = await db.companyMembership.findMany({ where: { tenantId }, select: { userId: true } });
  const userIds = memberships.map((m) => m.userId);
  const preferences = await db.notificationPreference.findMany({ where: { userId: { in: userIds } } });

  return {
    totalUsers: userIds.length,
    emailEnabled: preferences.filter((p) => p.email).length,
    whatsappEnabled: preferences.filter((p) => p.whatsapp).length,
  };
}

// --- Phase 18 — Access Revocation ----------------------------------------
// The only write to `accessMode` that existed before this was the hardcoded
// "STANDARD" in actions/users.ts:80, which means no membership could ever
// leave that state. `dal.ts` re-reads the membership on every request (see
// Audit C2), so a mode change here takes effect on the target's very next
// request — no session table to purge, no waiting for the 7-day cookie.
export async function setMemberAccessMode(
  tenantId: string,
  actor: { id: string; role: string },
  targetUserId: string,
  mode: AssignableAccessMode,
  reason?: string,
) {
  if (!ASSIGNABLE_ACCESS_MODES.includes(mode)) throw new Error("Unknown access mode.");

  // Lockout guard. An Owner suspending themselves with no other Owner active
  // would leave the tenant with no one able to undo it.
  if (targetUserId === actor.id) throw new Error("You cannot change your own access.");

  const membership = await db.companyMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: targetUserId } },
    include: { user: { select: { displayName: true } } },
  });
  if (!membership) throw new Error("Member not found.");
  if (membership.accessMode === mode) return membership;

  // Audit C3's boundary again: Admin holds the same permission matrix as
  // Owner, so without this an Admin could suspend the Owner and take the
  // tenant. Only an Owner may act on an Owner.
  if (membership.role === "OWNER" && actor.role !== "OWNER") {
    throw new Error("Only the Company Owner can change Owner-level access.");
  }

  if (membership.role === "OWNER" && mode !== "STANDARD") {
    const activeOwners = await db.companyMembership.count({
      where: { tenantId, role: "OWNER", accessMode: { in: ["STANDARD", "VIEW_ONLY"] } },
    });
    if (activeOwners <= 1) throw new Error("This is the last active Owner. Transfer ownership first.");
  }

  const updated = await db.companyMembership.update({
    where: { tenantId_userId: { tenantId, userId: targetUserId } },
    data: { accessMode: mode },
  });

  await db.auditEvent.create({
    data: {
      tenantId,
      actorId: actor.id,
      action: mode === "STANDARD" ? "MEMBER_ACCESS_RESTORED" : "MEMBER_ACCESS_REVOKED",
      targetType: "CompanyMembership",
      targetId: membership.id,
      metadata: JSON.stringify({
        targetUser: membership.user.displayName,
        from: membership.accessMode,
        to: mode,
        reason: reason ?? null,
      }),
    },
  });

  return updated;
}

// --- Phase 1 Track D — domain-event visibility -----------------------------
// DomainEvent is a well-formed transactional outbox, and its own schema comment
// says a PENDING/FAILED row is "exactly what a future background worker would
// sweep and retry". That worker does not exist, so until now a failed event was
// invisible unless someone queried the table by hand.
//
// This is deliberately not a job queue: a place to see stuck events, and a
// button. Automatic retry is a scheduler problem; manual retry is a button.
export async function listStuckDomainEvents(tenantId: string) {
  return db.domainEvent.findMany({
    where: { tenantId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function countStuckDomainEvents(tenantId: string) {
  return db.domainEvent.count({ where: { tenantId, status: { in: ["PENDING", "FAILED"] } } });
}
