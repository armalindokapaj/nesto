"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import {
  updateEmployeePhoto,
  updateEmployeeContact,
  addEmployeeDocument,
  removeEmployeeDocument,
} from "@/server/employee-profile";
import type { Role } from "@/lib/constants";

export type ProfileActionState = { error?: string; success?: boolean } | undefined;

export async function updateEmployeePhotoAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const { tenantId, user, role } = await getCurrentUser();
  const employeeId = String(formData.get("employeeId") ?? "");
  const photoDataUrl = formData.get("photoDataUrl");
  const remove = formData.get("remove") === "1";

  if (!employeeId) return { error: "Invalid request." };
  if (!remove && (typeof photoDataUrl !== "string" || !photoDataUrl.startsWith("data:image/"))) {
    return { error: "Choose an image file." };
  }
  // Rough cap in addition to the client-side check — a data URL this size
  // (~700KB raw image) keeps the request comfortably under Next.js's default
  // 1MB Server Action body limit.
  if (!remove && typeof photoDataUrl === "string" && photoDataUrl.length > 1_000_000) {
    return { error: "Image is too large. Please use a photo under 700KB." };
  }

  try {
    await updateEmployeePhoto(tenantId, employeeId, { userId: user.id, role: role as Role }, remove ? null : (photoDataUrl as string));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { success: true };
}

const ContactSchema = z.object({
  employeeId: z.string().min(1),
  phone: z.string().optional(),
});

export async function updateEmployeeContactAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const { tenantId, user, role } = await getCurrentUser();
  const parsed = ContactSchema.safeParse({
    employeeId: formData.get("employeeId"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await updateEmployeeContact(tenantId, parsed.data.employeeId, { userId: user.id, role: role as Role }, parsed.data.phone ?? "");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { success: true };
}

const DocumentSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1, "Enter a document name"),
  category: z.enum(["CV", "CERTIFICATION", "WORK_CONTRACT"]),
});

export async function addEmployeeDocumentAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const { tenantId, user, role } = await getCurrentUser();
  const parsed = DocumentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await addEmployeeDocument(tenantId, parsed.data.employeeId, { userId: user.id, role: role as Role }, {
      name: parsed.data.name,
      category: parsed.data.category,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { success: true };
}

export async function removeEmployeeDocumentAction(documentId: string, employeeId: string) {
  const { tenantId, user, role } = await getCurrentUser();
  await removeEmployeeDocument(tenantId, documentId, { userId: user.id, role: role as Role });
  revalidatePath(`/employees/${employeeId}`);
}
