"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import { registerBimModel, setBimModelStatus, addBimModelVersion, createBimObjectLink, removeBimObjectLink } from "@/server/bim";

export type BimActionState = { error?: string; success?: string } | undefined;
const errorState = (e: unknown, fallback: string) => ({ error: e instanceof Error ? e.message : fallback });
async function context(key?: string) {
  const c = await getCurrentUser();
  if (!can(c.role, "PROJECTS", "WRITE")) throw new Error("You do not have permission to manage BIM models.");
  if (key) await assertConfigEnabled(c.tenantId, key, c.company?.id);
  return c;
}

export async function registerBimModelAction(_: BimActionState, formData: FormData): Promise<BimActionState> {
  try {
    const c = await context("bim.action.register_model");
    const p = z.object({ projectId: z.string().min(1), name: z.string().min(2), discipline: z.string().optional(), description: z.string().optional() }).safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid model" };
    await registerBimModel(c.tenantId, c.user.id, p.data);
    revalidatePath("/dashboard/bim");
    return { success: "Model registered." };
  } catch (e) { return errorState(e, "Could not register model."); }
}

export async function setBimModelStatusAction(modelId: string, status: string) {
  const c = await context();
  await setBimModelStatus(c.tenantId, modelId, status);
  revalidatePath(`/dashboard/bim/${modelId}`);
  revalidatePath("/dashboard/bim");
}

export async function addBimModelVersionAction(_: BimActionState, formData: FormData): Promise<BimActionState> {
  try {
    const c = await context("bim.action.upload_version");
    const p = z.object({ modelId: z.string().min(1), documentId: z.string().optional(), fileName: z.string().optional(), notes: z.string().optional() }).safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid version" };
    await addBimModelVersion(c.tenantId, c.user.id, p.data);
    revalidatePath(`/dashboard/bim/${p.data.modelId}`);
    return { success: "Version registered." };
  } catch (e) { return errorState(e, "Could not register version."); }
}

export async function createBimObjectLinkAction(_: BimActionState, formData: FormData): Promise<BimActionState> {
  try {
    const c = await context("bim.action.link_object");
    const p = z.object({ modelId: z.string().min(1), objectRef: z.string().optional(), entityType: z.string().min(1), entityId: z.string().min(1), relation: z.string().optional() }).safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid link" };
    await createBimObjectLink(c.tenantId, c.user.id, p.data);
    revalidatePath(`/dashboard/bim/${p.data.modelId}`);
    return { success: "Link created." };
  } catch (e) { return errorState(e, "Could not create link."); }
}

export async function removeBimObjectLinkAction(linkId: string, modelId: string) {
  const c = await context();
  await removeBimObjectLink(c.tenantId, linkId);
  revalidatePath(`/dashboard/bim/${modelId}`);
}
