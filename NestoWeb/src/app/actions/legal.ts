"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createAuthority,
  createPermit,
  setPermitStatus,
  addPermitCondition,
  amendPermit,
  setLegalReadinessStatus,
  createLegalCase,
  setLegalCaseStatus,
  grantCaseAccess,
  revokeCaseAccess,
  createLegalHold,
  releaseLegalHold,
} from "@/server/legal";

const CreateAuthoritySchema = z.object({
  name: z.string().min(1),
  category: z.enum(["MUNICIPAL", "NATIONAL", "UTILITY", "FIRE", "ENVIRONMENTAL", "OTHER"]),
  contactInfo: z.string().optional(),
});

export type LegalActionState = { error: string } | undefined;

export async function createAuthorityAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to add authorities." };

  const parsed = CreateAuthoritySchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    contactInfo: formData.get("contactInfo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createAuthority(tenantId, parsed.data);
  revalidatePath("/dashboard/legal/permits");
  return undefined;
}

const CreatePermitSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  authorityId: z.string().min(1, "Select an authority"),
  permitType: z.enum(["BUILDING", "ENVIRONMENTAL", "OCCUPANCY", "DEMOLITION", "UTILITY_CONNECTION", "OTHER"]),
  referenceNumber: z.string().optional(),
  confidentialityLevel: z.enum(["STANDARD", "RESTRICTED", "CONFIDENTIAL"]).optional(),
});

export async function createPermitAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "WRITE")) return { error: "You do not have permission to create permits." };

  const parsed = CreatePermitSchema.safeParse({
    projectId: formData.get("projectId"),
    authorityId: formData.get("authorityId"),
    permitType: formData.get("permitType"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    confidentialityLevel: formData.get("confidentialityLevel") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createPermit(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/legal/permits");
  revalidatePath("/dashboard/legal");
  return undefined;
}

export async function setPermitStatusAction(permitId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) throw new Error("You do not have permission to change permit status.");
  await setPermitStatus(tenantId, user.id, permitId, status);
  revalidatePath(`/dashboard/legal/permits/${permitId}`);
  revalidatePath("/dashboard/legal/permits");
}

const AddConditionSchema = z.object({
  permitId: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.coerce.date().optional(),
});

export async function addPermitConditionAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "WRITE")) return { error: "You do not have permission to add conditions." };

  const parsed = AddConditionSchema.safeParse({
    permitId: formData.get("permitId"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { permitId, ...input } = parsed.data;
  await addPermitCondition(tenantId, permitId, input);
  revalidatePath(`/dashboard/legal/permits/${permitId}`);
  return undefined;
}

const AmendPermitSchema = z.object({
  permitId: z.string().min(1),
  description: z.string().min(1),
  newExpiryDate: z.coerce.date().optional(),
});

export async function amendPermitAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to amend permits." };

  const parsed = AmendPermitSchema.safeParse({
    permitId: formData.get("permitId"),
    description: formData.get("description"),
    newExpiryDate: formData.get("newExpiryDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { permitId, ...input } = parsed.data;
  await amendPermit(tenantId, user.id, permitId, input);
  revalidatePath(`/dashboard/legal/permits/${permitId}`);
  return undefined;
}

const SetReadinessSchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(["READY", "READY_WITH_CONDITIONS", "RESTRICTED", "BLOCKED", "UNKNOWN"]),
  reason: z.string().optional(),
});

export async function setLegalReadinessStatusAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to set the Legal Readiness Gate." };

  const parsed = SetReadinessSchema.safeParse({
    projectId: formData.get("projectId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await setLegalReadinessStatus(tenantId, user.id, parsed.data.projectId, parsed.data.status, parsed.data.reason);
  revalidatePath(`/dashboard/legal/projects/${parsed.data.projectId}`);
  revalidatePath("/dashboard/legal");
  return undefined;
}

// ---------------------------------------------------------------------------
// Cases, Disputes & Legal Hold
// ---------------------------------------------------------------------------

const CreateCaseSchema = z.object({
  title: z.string().min(1, "Enter a case title"),
  caseType: z.enum(["LITIGATION", "CLAIM", "DISPUTE", "REGULATORY", "OTHER"]),
  projectId: z.string().optional(),
  counterparty: z.string().optional(),
  summary: z.string().optional(),
  confidentialityTier: z.enum(["STANDARD", "RESTRICTED", "CONFIDENTIAL", "LEGAL_PRIVILEGED", "EXECUTIVE", "LITIGATION_RESTRICTED", "EXTERNAL_COUNSEL_ONLY"]).optional(),
});

export async function createLegalCaseAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "WRITE")) return { error: "You do not have permission to open a case." };

  const parsed = CreateCaseSchema.safeParse({
    title: formData.get("title"),
    caseType: formData.get("caseType"),
    projectId: formData.get("projectId") || undefined,
    counterparty: formData.get("counterparty") || undefined,
    summary: formData.get("summary") || undefined,
    confidentialityTier: formData.get("confidentialityTier") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const legalCase = await createLegalCase(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/legal/cases");
  revalidatePath(`/dashboard/legal/cases/${legalCase.id}`);
  return undefined;
}

export async function setLegalCaseStatusAction(caseId: string, status: string): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to change case status." };
  try {
    await setLegalCaseStatus(tenantId, user.id, caseId, status);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update case." };
  }
  revalidatePath(`/dashboard/legal/cases/${caseId}`);
  revalidatePath("/dashboard/legal/cases");
  return undefined;
}

export async function grantCaseAccessAction(caseId: string, userId: string): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to grant case access." };
  await grantCaseAccess(tenantId, user.id, caseId, userId);
  revalidatePath(`/dashboard/legal/cases/${caseId}`);
  return undefined;
}

export async function revokeCaseAccessAction(caseId: string, accessId: string): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to revoke case access." };
  await revokeCaseAccess(tenantId, user.id, accessId);
  revalidatePath(`/dashboard/legal/cases/${caseId}`);
  return undefined;
}

const CreateHoldSchema = z.object({
  caseId: z.string().optional(),
  scope: z.string().min(1, "Describe what this hold covers"),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
});

export async function createLegalHoldAction(_prev: LegalActionState, formData: FormData): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to place a legal hold." };

  const parsed = CreateHoldSchema.safeParse({
    caseId: formData.get("caseId") || undefined,
    scope: formData.get("scope"),
    targetType: formData.get("targetType") || undefined,
    targetId: formData.get("targetId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createLegalHold(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/legal/holds");
  if (parsed.data.caseId) revalidatePath(`/dashboard/legal/cases/${parsed.data.caseId}`);
  return undefined;
}

export async function releaseLegalHoldAction(holdId: string, caseId?: string): Promise<LegalActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "FULL")) return { error: "You do not have permission to release a legal hold." };
  try {
    await releaseLegalHold(tenantId, user.id, holdId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not release hold." };
  }
  revalidatePath("/dashboard/legal/holds");
  if (caseId) revalidatePath(`/dashboard/legal/cases/${caseId}`);
  return undefined;
}
