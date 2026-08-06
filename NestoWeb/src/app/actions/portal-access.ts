"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { assertConfigEnabled } from "@/server/platform-config";
import {
  createExternalOrganization,
  addPortalMember,
  removePortalMember,
  grantProjectAccess,
  revokeProjectAccess,
} from "@/server/portal-access";

export type PortalAccessActionState = { error: string } | undefined;

const PATH = "/dashboard/admin/portal-access";

function requireManage(role: Role) {
  if (!can(role, "COMPANY_SETTINGS", "FULL")) return "You do not have permission to manage portal access.";
  return null;
}

const CreateOrgSchema = z.object({
  name: z.string().min(1, "Enter an organization name"),
  orgType: z.enum(["CLIENT", "SUPPLIER"]),
});

export async function createExternalOrganizationAction(_prev: PortalAccessActionState, formData: FormData): Promise<PortalAccessActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireManage(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "portal_access.action.create_org");
  const parsed = CreateOrgSchema.safeParse({ name: formData.get("name"), orgType: formData.get("orgType") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createExternalOrganization(tenantId, user.id, parsed.data);
  revalidatePath(PATH);
  return undefined;
}

export async function addPortalMemberAction(externalOrgId: string, userId: string): Promise<PortalAccessActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireManage(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "portal_access.action.manage_membership");
  await addPortalMember(tenantId, user.id, externalOrgId, userId);
  revalidatePath(PATH);
  return undefined;
}

export async function removePortalMemberAction(membershipId: string): Promise<PortalAccessActionState> {
  const { tenantId, role } = await getCurrentUser();
  const err = requireManage(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "portal_access.action.manage_membership");
  await removePortalMember(tenantId, membershipId);
  revalidatePath(PATH);
  return undefined;
}

export async function grantProjectAccessAction(externalOrgId: string, projectId: string): Promise<PortalAccessActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireManage(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "portal_access.action.grant_project_access");
  await grantProjectAccess(tenantId, user.id, externalOrgId, projectId);
  revalidatePath(PATH);
  return undefined;
}

export async function revokeProjectAccessAction(accessId: string): Promise<PortalAccessActionState> {
  const { tenantId, role } = await getCurrentUser();
  const err = requireManage(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "portal_access.action.grant_project_access");
  await revokeProjectAccess(tenantId, accessId);
  revalidatePath(PATH);
  return undefined;
}
