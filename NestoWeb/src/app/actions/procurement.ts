"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createSupplier, createPurchaseOrder, updatePurchaseOrderStatus } from "@/server/procurement";

const CreateSupplierSchema = z.object({
  name: z.string().min(2, "Enter a supplier name"),
  category: z.string().min(2, "Enter a category"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export type CreateSupplierState = { error: string } | undefined;

export async function createSupplierAction(_prev: CreateSupplierState, formData: FormData): Promise<CreateSupplierState> {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "WRITE")) {
    return { error: "You do not have permission to add suppliers." };
  }

  const parsed = CreateSupplierSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createSupplier(tenantId, { ...parsed.data, email: parsed.data.email || undefined });
  revalidatePath("/dashboard/procurement/suppliers");
  revalidatePath("/dashboard/procurement");
  return undefined;
}

const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  projectId: z.string().optional(),
  description: z.string().min(2, "Describe what's being purchased"),
  amount: z.coerce.number().positive("Enter an amount"),
});

export type CreatePurchaseOrderState = { error: string } | undefined;

export async function createPurchaseOrderAction(
  _prev: CreatePurchaseOrderState,
  formData: FormData
): Promise<CreatePurchaseOrderState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "WRITE")) {
    return { error: "You do not have permission to create purchase orders." };
  }

  const parsed = CreatePurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    projectId: formData.get("projectId") || undefined,
    description: formData.get("description"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createPurchaseOrder(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/procurement/orders");
  revalidatePath("/dashboard/procurement");
  return undefined;
}

export async function updatePurchaseOrderStatusAction(purchaseOrderId: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "WRITE")) {
    throw new Error("You do not have permission to update purchase orders.");
  }
  await updatePurchaseOrderStatus(tenantId, purchaseOrderId, status);
  revalidatePath("/dashboard/procurement/orders");
  revalidatePath("/dashboard/procurement");
}
