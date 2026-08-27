"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { allocateNumber } from "@/server/number-series";
import { requireTenantProject } from "@/lib/tenant";
import {
  createDrawingRevision,
  decideDrawingRevision,
  respondToRfi,
  createSubmittal,
  decideSubmittal,
  updateClientRequestStatus,
  assignClientRequest,
} from "@/server/architecture";
import { toActionError } from "@/lib/errors";

type ActionState = { error: string } | { ok: true } | undefined;

function assertProjectsWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROJECTS", "WRITE")) throw new Error("Not authorized");
}

export async function decideDrawingAction(drawingId: string, decision: "APPROVED" | "NEEDS_REVISION") {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) {
    throw new Error("You do not have permission to review drawings.");
  }

  const drawing = await db.drawing.findUnique({ where: { id: drawingId } });
  if (!drawing || drawing.tenantId !== tenantId) {
    throw new Error("Drawing not found.");
  }

  await db.drawing.update({ where: { id: drawingId }, data: { status: decision } });
  revalidatePath("/dashboard/architect/approvals");
  revalidatePath("/dashboard/architect/drawings");
  revalidatePath("/dashboard/architect");
}

const CreateRfiSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2),
});

export type CreateRfiState = { error: string } | undefined;

export async function createRfiAction(_prev: CreateRfiState, formData: FormData): Promise<CreateRfiState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "WRITE")) {
    return { error: "You do not have permission to create RFIs." };
  }

  const parsed = CreateRfiSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await requireTenantProject(tenantId, parsed.data.projectId);
  } catch {
    return { error: "Project not found." };
  }

  const code = await allocateNumber(tenantId, "RFI");
  await db.rFI.create({ data: { tenantId, projectId: parsed.data.projectId, title: parsed.data.title, code } });
  revalidatePath("/dashboard/architect/rfis");
  return undefined;
}

// ---------------------------------------------------------------------------
// Drawing revisions (§17)
// ---------------------------------------------------------------------------

const CreateRevisionSchema = z.object({
  drawingId: z.string().min(1),
  code: z.string().min(1, "Enter a revision code"),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
});

export async function createDrawingRevisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateRevisionSchema.safeParse({
    drawingId: formData.get("drawingId"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
    fileUrl: formData.get("fileUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createDrawingRevision(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create revision") };
  }
  revalidatePath("/dashboard/architect/revisions");
  revalidatePath("/dashboard/architect/drawings");
  revalidatePath("/dashboard/architect");
  return { ok: true };
}

export async function decideDrawingRevisionAction(revisionId: string, decision: "APPROVED" | "RETURNED") {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await decideDrawingRevision(tenantId, revisionId, decision);
  revalidatePath("/dashboard/architect/revisions");
  revalidatePath("/dashboard/architect/drawings");
  revalidatePath("/dashboard/architect");
}

// ---------------------------------------------------------------------------
// RFI response
// ---------------------------------------------------------------------------

export async function respondToRfiAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const rfiId = formData.get("rfiId");
  const response = formData.get("response");
  if (typeof rfiId !== "string" || typeof response !== "string" || !response.trim()) return { error: "Write a response first" };
  try {
    assertProjectsWrite(role);
    await respondToRfi(tenantId, user.id, { rfiId, response });
  } catch (error) {
    return { error: toActionError(error, "Could not respond to RFI") };
  }
  revalidatePath("/dashboard/architect/rfis");
  revalidatePath("/dashboard/engineering/rfis");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Submittals (§19)
// ---------------------------------------------------------------------------

const CreateSubmittalSchema = z.object({
  projectId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  discipline: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  fileUrl: z.string().optional(),
});

export async function createSubmittalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateSubmittalSchema.safeParse({
    projectId: formData.get("projectId"),
    type: formData.get("type") || "MATERIAL",
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
    description: formData.get("description") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    fileUrl: formData.get("fileUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createSubmittal(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create submittal") };
  }
  revalidatePath("/dashboard/architect/submittals");
  revalidatePath("/dashboard/engineering/submittals");
  return { ok: true };
}

export async function decideSubmittalAction(id: string, decision: "APPROVED" | "REJECTED" | "RETURNED", comment?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertProjectsWrite(role);
  await decideSubmittal(tenantId, user.id, { id, decision, comment });
  revalidatePath("/dashboard/architect/submittals");
  revalidatePath("/dashboard/engineering/submittals");
}

// ---------------------------------------------------------------------------
// Client Requests (§20)
// ---------------------------------------------------------------------------

export async function updateClientRequestStatusAction(id: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await updateClientRequestStatus(tenantId, id, status);
  revalidatePath("/dashboard/architect/client-requests");
}

export async function assignClientRequestAction(id: string, assignedArchitectId: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await assignClientRequest(tenantId, id, assignedArchitectId);
  revalidatePath("/dashboard/architect/client-requests");
}
