"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  updateTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  archiveTeam,
  restoreTeam,
} from "@/server/teams-module";

// PRD_Teams_Module — additive actions on top of src/app/actions/admin.ts's
// createTeamAction. Gated the same way that action already is: team
// management is a USER_MANAGEMENT:FULL admin action, since a team roster is
// an organisational record, not per-project self-service.

type ActionState = { error: string } | { ok: true } | undefined;

function assertTeamAdmin(role: Parameters<typeof can>[0]) {
  if (!can(role, "USER_MANAGEMENT", "FULL")) throw new Error("Not authorized");
}

const UpdateTeamSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  teamType: z.string().optional(),
  leadId: z.string().optional(),
});

export async function updateTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = UpdateTeamSchema.safeParse({
    teamId: formData.get("teamId"),
    name: formData.get("name") || undefined,
    description: formData.get("description") ?? undefined,
    teamType: formData.get("teamType") ?? undefined,
    leadId: formData.get("leadId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertTeamAdmin(role);
    await updateTeam(tenantId, {
      teamId: parsed.data.teamId,
      name: parsed.data.name,
      description: parsed.data.description === "" ? null : parsed.data.description,
      teamType: parsed.data.teamType === "" ? null : parsed.data.teamType,
      leadId: parsed.data.leadId === "" ? null : parsed.data.leadId,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update team" };
  }

  revalidatePath(`/dashboard/admin/teams/${parsed.data.teamId}`);
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

const MemberSchema = z.object({ teamId: z.string().min(1), userId: z.string().min(1), role: z.string().optional() });

export async function addTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = MemberSchema.safeParse({
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { error: "Select a person to add." };

  try {
    assertTeamAdmin(role);
    await addTeamMember(tenantId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add member" };
  }

  revalidatePath(`/dashboard/admin/teams/${parsed.data.teamId}`);
  return { ok: true };
}

export async function updateTeamMemberRoleAction(teamId: string, userId: string, role: string) {
  const { tenantId, role: viewerRole } = await getCurrentUser();
  assertTeamAdmin(viewerRole);
  await updateTeamMemberRole(tenantId, { teamId, userId, role });
  revalidatePath(`/dashboard/admin/teams/${teamId}`);
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertTeamAdmin(role);
  await removeTeamMember(tenantId, { teamId, userId });
  revalidatePath(`/dashboard/admin/teams/${teamId}`);
}

export async function archiveTeamAction(teamId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertTeamAdmin(role);
  await archiveTeam(tenantId, teamId);
  revalidatePath("/dashboard/admin/teams");
  revalidatePath(`/dashboard/admin/teams/${teamId}`);
}

export async function restoreTeamAction(teamId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertTeamAdmin(role);
  await restoreTeam(tenantId, teamId);
  revalidatePath("/dashboard/admin/teams");
  revalidatePath(`/dashboard/admin/teams/${teamId}`);
}
