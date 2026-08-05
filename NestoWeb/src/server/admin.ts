import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";

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
