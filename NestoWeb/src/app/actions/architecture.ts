"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { allocateNumber } from "@/server/number-series";
import { requireTenantProject } from "@/lib/tenant";

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
