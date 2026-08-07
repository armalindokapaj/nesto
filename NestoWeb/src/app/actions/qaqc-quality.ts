"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createNcr,
  advanceNcrStage,
  reopenNcr,
  createDefect,
  assignDefect,
  markDefectInCorrection,
  submitDefectForReview,
  verifyDefect,
  rejectDefectVerification,
  closeDefect,
  reopenDefect,
} from "@/server/qaqc";

type ActionState = { error: string } | { ok: true } | undefined;

// Same reasoning as src/app/actions/qaqc.ts's assertProjectsWrite — QAQC has
// no dedicated coarse Resource, so quality actions authorize on role
// identity for QAQC or the existing PROJECTS:WRITE roles.
function assertQaqcWrite(role: Parameters<typeof can>[0]) {
  if (role !== "QAQC" && !can(role, "PROJECTS", "WRITE")) throw new Error("Not authorized");
}

const CreateNcrSchema = z.object({
  projectId: z.string().min(1),
  description: z.string().min(1),
  requirement: z.string().optional(),
  discipline: z.string().optional(),
  location: z.string().optional(),
  severity: z.string().optional(),
  inspectionRequestId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export async function createNcrAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateNcrSchema.safeParse({
    projectId: formData.get("projectId"),
    description: formData.get("description"),
    requirement: formData.get("requirement") || undefined,
    discipline: formData.get("discipline") || undefined,
    location: formData.get("location") || undefined,
    severity: formData.get("severity") || undefined,
    inspectionRequestId: formData.get("inspectionRequestId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertQaqcWrite(role);
    await createNcr(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create NCR" };
  }
  revalidatePath("/dashboard/qaqc/ncrs");
  return { ok: true };
}

export async function advanceNcrStageAction(id: string, nextStage: string, note?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await advanceNcrStage(tenantId, user.id, { id, nextStage: nextStage as Parameters<typeof advanceNcrStage>[2]["nextStage"], note });
  revalidatePath("/dashboard/qaqc/ncrs");
  revalidatePath(`/dashboard/qaqc/ncrs/${id}`);
}

export async function reopenNcrAction(id: string, reason: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await reopenNcr(tenantId, user.id, id, reason);
  revalidatePath(`/dashboard/qaqc/ncrs/${id}`);
}

const CreateDefectSchema = z.object({
  projectId: z.string().min(1),
  type: z.string().optional(),
  description: z.string().min(1),
  location: z.string().optional(),
  severity: z.string().optional(),
  assignedToId: z.string().optional(),
});

export async function createDefectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateDefectSchema.safeParse({
    projectId: formData.get("projectId"),
    type: formData.get("type") || undefined,
    description: formData.get("description"),
    location: formData.get("location") || undefined,
    severity: formData.get("severity") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertQaqcWrite(role);
    await createDefect(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create defect" };
  }
  revalidatePath("/dashboard/qaqc/defects");
  return { ok: true };
}

export async function assignDefectAction(id: string, assignedToId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await assignDefect(tenantId, user.id, id, assignedToId);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function markDefectInCorrectionAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await markDefectInCorrection(tenantId, user.id, id);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function submitDefectForReviewAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await submitDefectForReview(tenantId, user.id, id);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function verifyDefectAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await verifyDefect(tenantId, user.id, id);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function rejectDefectVerificationAction(id: string, reason: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await rejectDefectVerification(tenantId, user.id, id, reason);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function closeDefectAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await closeDefect(tenantId, user.id, id);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}

export async function reopenDefectAction(id: string, reason: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertQaqcWrite(role);
  await reopenDefect(tenantId, user.id, id, reason);
  revalidatePath(`/dashboard/qaqc/defects/${id}`);
}
