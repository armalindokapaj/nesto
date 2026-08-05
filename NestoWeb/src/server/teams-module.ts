import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import type { TeamRole } from "@/lib/team-constants";

export { TEAM_TYPE_SUGGESTIONS, TEAM_ROLES } from "@/lib/team-constants";
export type { TeamRole } from "@/lib/team-constants";

// PRD_Teams_Module — additive layer on top of the existing thin Team/
// TeamMember models (src/server/admin.ts's listTeams, admin-only Teams grid).
// §37 Data Ownership Rules / §6: a team is an organisational grouping only —
// membership never changes employment, never grants task, document or
// project access on its own. Nothing here creates or removes access; it only
// records who belongs to which team and in what capacity.

export async function getTeamDetail(tenantId: string, teamId: string) {
  return assertTenant(
    await db.team.findUnique({
      where: { id: teamId },
      include: {
        lead: { select: { id: true, displayName: true, avatarColor: true } },
        members: {
          include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    tenantId,
    "Team"
  );
}

export async function updateTeam(
  tenantId: string,
  input: { teamId: string; name?: string; description?: string | null; teamType?: string | null; leadId?: string | null }
) {
  assertTenant(await db.team.findUnique({ where: { id: input.teamId } }), tenantId, "Team");
  if (input.leadId) {
    const leadMembership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: input.teamId, userId: input.leadId } },
    });
    if (!leadMembership) throw new Error("The team lead must already be a member of the team.");
  }
  return db.team.update({
    where: { id: input.teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.teamType !== undefined ? { teamType: input.teamType } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
    },
  });
}

export async function addTeamMember(tenantId: string, input: { teamId: string; userId: string; role?: TeamRole | string }) {
  assertTenant(await db.team.findUnique({ where: { id: input.teamId } }), tenantId, "Team");
  const membership = await db.companyMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: input.userId } },
  });
  if (!membership) throw new Error("That person is not a member of this company.");

  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
  });
  if (existing) return existing;

  return db.teamMember.create({
    data: { teamId: input.teamId, userId: input.userId, role: input.role ?? "MEMBER" },
  });
}

export async function updateTeamMemberRole(tenantId: string, input: { teamId: string; userId: string; role: string }) {
  assertTenant(await db.team.findUnique({ where: { id: input.teamId } }), tenantId, "Team");
  return db.teamMember.update({
    where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
    data: { role: input.role },
  });
}

export async function removeTeamMember(tenantId: string, input: { teamId: string; userId: string }) {
  const team = assertTenant(await db.team.findUnique({ where: { id: input.teamId } }), tenantId, "Team");
  if (team.leadId === input.userId) {
    throw new Error("Assign a different team lead before removing this member.");
  }
  await db.teamMember.delete({ where: { teamId_userId: { teamId: input.teamId, userId: input.userId } } });
}

export async function archiveTeam(tenantId: string, teamId: string) {
  assertTenant(await db.team.findUnique({ where: { id: teamId } }), tenantId, "Team");
  return db.team.update({ where: { id: teamId }, data: { archivedAt: new Date() } });
}

export async function restoreTeam(tenantId: string, teamId: string) {
  assertTenant(await db.team.findUnique({ where: { id: teamId } }), tenantId, "Team");
  return db.team.update({ where: { id: teamId }, data: { archivedAt: null } });
}
