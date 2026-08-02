"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

const CreateTeamSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export type CreateTeamState = { error: string } | undefined;

export async function createTeamAction(_prev: CreateTeamState, formData: FormData): Promise<CreateTeamState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) {
    return { error: "You do not have permission to create teams." };
  }

  const parsed = CreateTeamSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.team.create({ data: { tenantId, ...parsed.data } });
  revalidatePath("/dashboard/admin/teams");
  return undefined;
}

export async function revokeInvitationAction(invitationId: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) {
    throw new Error("You do not have permission to manage invitations.");
  }

  const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.tenantId !== tenantId) {
    throw new Error("Invitation not found.");
  }

  await db.invitation.update({ where: { id: invitationId }, data: { status: "REVOKED", respondedAt: new Date() } });
  revalidatePath("/dashboard/admin/invitations");
  revalidatePath("/dashboard/admin");
}

export async function resendInvitationAction(invitationId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "FULL")) {
    throw new Error("You do not have permission to manage invitations.");
  }

  const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.tenantId !== tenantId) {
    throw new Error("Invitation not found.");
  }

  await db.invitation.update({ where: { id: invitationId }, data: { invitedAt: new Date() } });
  await db.auditEvent.create({
    data: { tenantId, actorId: user.id, action: "INVITATION_RESENT", targetType: "Invitation", targetId: invitationId },
  });
  revalidatePath("/dashboard/admin/invitations");
}

export async function updatePlanNameAction(formData: FormData) {
  const { role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL") || !company) {
    throw new Error("You do not have permission to change the subscription plan.");
  }

  const planName = String(formData.get("planName") ?? "").trim();
  if (!planName) return;

  await db.company.update({ where: { id: company.id }, data: { planName } });
  revalidatePath("/dashboard/admin/subscription");
}
