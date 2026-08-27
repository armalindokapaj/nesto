"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createInspectionRequest,
  scheduleInspection,
  markInspectionReady,
  startInspection,
  issueInspectionResult,
  reopenForReinspection,
} from "@/server/qaqc";
import { toActionError } from "@/lib/errors";

type ActionState = { error: string } | { ok: true } | undefined;

// QAQC has no dedicated coarse Resource in the permission matrix (the role
// only holds PROJECTS:READ) — same gap STOCK had with PROCUREMENT before its
// build. Quality-control actions authorize on role identity for QAQC, or the
// existing PROJECTS:WRITE roles (Engineer/Architect/PM/...) that already
// manage inspections today.
function assertProjectsWrite(role: Parameters<typeof can>[0]) {
  if (role !== "QAQC" && !can(role, "PROJECTS", "WRITE")) throw new Error("Not authorized");
}

const CreateInspectionSchema = z.object({
  projectId: z.string().min(1),
  workPackage: z.string().optional(),
  discipline: z.string().optional(),
  inspectionType: z.string().optional(),
  location: z.string().optional(),
  quantity: z.string().optional(),
  requestedDate: z.coerce.date().optional(),
  plannedDate: z.coerce.date().optional(),
  inspectorId: z.string().optional(),
});

export async function createInspectionRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateInspectionSchema.safeParse({
    projectId: formData.get("projectId"),
    workPackage: formData.get("workPackage") || undefined,
    discipline: formData.get("discipline") || undefined,
    inspectionType: formData.get("inspectionType") || undefined,
    location: formData.get("location") || undefined,
    quantity: formData.get("quantity") || undefined,
    requestedDate: formData.get("requestedDate") || undefined,
    plannedDate: formData.get("plannedDate") || undefined,
    inspectorId: formData.get("inspectorId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createInspectionRequest(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create inspection request") };
  }
  revalidatePath("/dashboard/engineering/inspections");
  return { ok: true };
}

export async function scheduleInspectionAction(id: string, plannedDate: string, inspectorId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await scheduleInspection(tenantId, { id, plannedDate: new Date(plannedDate), inspectorId });
  revalidatePath("/dashboard/engineering/inspections");
}

export async function markInspectionReadyAction(id: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await markInspectionReady(tenantId, id);
  revalidatePath("/dashboard/engineering/inspections");
}

export async function startInspectionAction(id: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await startInspection(tenantId, id);
  revalidatePath("/dashboard/engineering/inspections");
}

export async function issueInspectionResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const id = formData.get("id");
  const result = formData.get("result");
  const evidenceNotes = formData.get("evidenceNotes");
  if (typeof id !== "string" || typeof result !== "string") return { error: "Invalid input" };
  try {
    assertProjectsWrite(role);
    await issueInspectionResult(tenantId, user.id, { id, result, evidenceNotes: typeof evidenceNotes === "string" ? evidenceNotes : undefined });
  } catch (error) {
    return { error: toActionError(error, "Could not issue result") };
  }
  revalidatePath("/dashboard/engineering/inspections");
  return { ok: true };
}

export async function reopenForReinspectionAction(id: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await reopenForReinspection(tenantId, id);
  revalidatePath("/dashboard/engineering/inspections");
}
