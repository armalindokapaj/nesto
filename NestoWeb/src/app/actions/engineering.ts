"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createEngineeringPackage,
  createSpecification,
  createCalculation,
  createCoordinationIssue,
  updateCoordinationIssueStatus,
} from "@/server/engineering";

type ActionState = { error: string } | { ok: true } | undefined;

function assertProjectsWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROJECTS", "WRITE")) throw new Error("Not authorized");
}

const CreatePackageSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  discipline: z.string().optional(),
  scope: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export async function createEngineeringPackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreatePackageSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
    scope: formData.get("scope") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createEngineeringPackage(tenantId, { ...parsed.data, ownerId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create package" };
  }
  revalidatePath("/dashboard/engineering/packages");
  return { ok: true };
}

const CreateSpecificationSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  discipline: z.string().optional(),
  category: z.string().optional(),
  scope: z.string().optional(),
  packageId: z.string().optional(),
  fileDataUrl: z.string().optional(),
});

export async function createSpecificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateSpecificationSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
    category: formData.get("category") || undefined,
    scope: formData.get("scope") || undefined,
    packageId: formData.get("packageId") || undefined,
    fileDataUrl: formData.get("fileDataUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createSpecification(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create specification" };
  }
  revalidatePath("/dashboard/engineering/specifications");
  return { ok: true };
}

const CreateCalculationSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  discipline: z.string().optional(),
  type: z.string().optional(),
  technicalScope: z.string().optional(),
  assumptions: z.string().optional(),
  packageId: z.string().optional(),
  checkerId: z.string().optional(),
  fileDataUrl: z.string().optional(),
});

export async function createCalculationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateCalculationSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
    type: formData.get("type") || undefined,
    technicalScope: formData.get("technicalScope") || undefined,
    assumptions: formData.get("assumptions") || undefined,
    packageId: formData.get("packageId") || undefined,
    checkerId: formData.get("checkerId") || undefined,
    fileDataUrl: formData.get("fileDataUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createCalculation(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create calculation" };
  }
  revalidatePath("/dashboard/engineering/calculations");
  return { ok: true };
}

const CreateCoordinationSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Enter a title"),
  discipline: z.string().optional(),
  priority: z.string().optional(),
  viewpointRef: z.string().optional(),
});

export async function createCoordinationIssueAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CreateCoordinationSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
    priority: formData.get("priority") || undefined,
    viewpointRef: formData.get("viewpointRef") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertProjectsWrite(role);
    await createCoordinationIssue(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create issue" };
  }
  revalidatePath("/dashboard/engineering/coordination");
  return { ok: true };
}

export async function updateCoordinationIssueStatusAction(id: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  assertProjectsWrite(role);
  await updateCoordinationIssueStatus(tenantId, id, status);
  revalidatePath("/dashboard/engineering/coordination");
}
