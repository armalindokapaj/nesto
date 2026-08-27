"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  toggleContractStar,
  updateContractDetails,
  archiveContract,
  restoreContract,
  addContractParty,
  removeContractParty,
  addObligation,
  updateObligationStatus,
  addMilestone,
  updateMilestoneStatus,
} from "@/server/contracts";

// PRD_Contracts_Module — additive actions. Create/edit-value and the
// lifecycle transitions (submit/approve/activate/terminate/...) continue to
// run through src/app/actions/contracts.ts and contract-lifecycle.ts.

type ActionState = { error: string } | { ok: true } | undefined;

function assertContractsWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "CONTRACTS", "WRITE")) throw new Error("Not authorized");
}
function assertContractsFull(role: Parameters<typeof can>[0]) {
  if (!can(role, "CONTRACTS", "FULL")) throw new Error("Not authorized");
}

export async function toggleContractStarAction(contractId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CONTRACTS", "READ")) throw new Error("Not authorized");
  const result = await toggleContractStar(tenantId, contractId, user.id);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  return result;
}

const UpdateContractSchema = z.object({
  contractId: z.string().min(1),
  contractType: z.string().optional(),
  responsibleUserId: z.string().optional(),
});

export async function updateContractDetailsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = UpdateContractSchema.safeParse({
    contractId: formData.get("contractId"),
    contractType: formData.get("contractType") ?? undefined,
    responsibleUserId: formData.get("responsibleUserId") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertContractsWrite(role);
    await updateContractDetails(tenantId, {
      contractId: parsed.data.contractId,
      contractType: parsed.data.contractType || null,
      responsibleUserId: parsed.data.responsibleUserId || null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update contract" };
  }

  revalidatePath(`/contracts/${parsed.data.contractId}`);
  return { ok: true };
}

export async function archiveContractAction(contractId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertContractsFull(role);
  await archiveContract(tenantId, contractId, user.id);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
}

export async function restoreContractAction(contractId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertContractsFull(role);
  await restoreContract(tenantId, contractId, user.id);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
}

const PartySchema = z.object({
  contractId: z.string().min(1),
  role: z.string().min(1, "Choose a party role"),
  legalName: z.string().min(1, "Enter a legal name"),
  partyEntityType: z.string().optional(),
  representativeName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  signingAuthority: z.boolean().optional(),
});

export async function addContractPartyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = PartySchema.safeParse({
    contractId: formData.get("contractId"),
    role: formData.get("role"),
    legalName: formData.get("legalName"),
    partyEntityType: formData.get("partyEntityType") || undefined,
    representativeName: formData.get("representativeName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    signingAuthority: formData.get("signingAuthority") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertContractsWrite(role);
    await addContractParty(tenantId, { ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add party" };
  }

  revalidatePath(`/contracts/${parsed.data.contractId}`);
  return { ok: true };
}

export async function removeContractPartyAction(partyId: string, contractId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertContractsWrite(role);
  await removeContractParty(tenantId, partyId, user.id);
  revalidatePath(`/contracts/${contractId}`);
}

const ObligationSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  partyId: z.string().optional(),
  ownerId: z.string().optional(),
  dueAt: z.string().optional(),
  priority: z.string().optional(),
  evidenceRequired: z.boolean().optional(),
});

export async function addObligationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = ObligationSchema.safeParse({
    contractId: formData.get("contractId"),
    title: formData.get("title"),
    partyId: formData.get("partyId") || undefined,
    ownerId: formData.get("ownerId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    priority: formData.get("priority") || undefined,
    evidenceRequired: formData.get("evidenceRequired") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertContractsWrite(role);
    await addObligation(tenantId, {
      ...parsed.data,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      actorId: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add obligation" };
  }

  revalidatePath(`/contracts/${parsed.data.contractId}`);
  return { ok: true };
}

export async function updateObligationStatusAction(obligationId: string, contractId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertContractsWrite(role);
  await updateObligationStatus(tenantId, { obligationId, status, actorId: user.id });
  revalidatePath(`/contracts/${contractId}`);
}

const MilestoneSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  plannedAt: z.string().optional(),
  partyId: z.string().optional(),
  paymentTrigger: z.boolean().optional(),
});

export async function addMilestoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = MilestoneSchema.safeParse({
    contractId: formData.get("contractId"),
    title: formData.get("title"),
    plannedAt: formData.get("plannedAt") || undefined,
    partyId: formData.get("partyId") || undefined,
    paymentTrigger: formData.get("paymentTrigger") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertContractsWrite(role);
    await addMilestone(tenantId, {
      ...parsed.data,
      plannedAt: parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : undefined,
      actorId: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add milestone" };
  }

  revalidatePath(`/contracts/${parsed.data.contractId}`);
  return { ok: true };
}

export async function updateMilestoneStatusAction(milestoneId: string, contractId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertContractsWrite(role);
  await updateMilestoneStatus(tenantId, { milestoneId, status, actorId: user.id });
  revalidatePath(`/contracts/${contractId}`);
}
