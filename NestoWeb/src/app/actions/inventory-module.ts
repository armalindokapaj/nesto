"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createProductCategory,
  createUnitOfMeasure,
  createProduct,
  createWarehouse,
  createMovement,
  postMovement,
  reverseMovement,
  confirmMovementReceipt,
  disputeMovementReceipt,
} from "@/server/inventory-module";
import type { MovementType } from "@/lib/inventory-constants";
import { toActionError } from "@/lib/errors";
import { tenantDefaultCurrency } from "@/lib/tenant";
import { toMinorUnits } from "@/lib/money";

// PRD_Inventory_Module — gated on PROCUREMENT:WRITE for day-to-day master
// data and drafting movements, PROCUREMENT:FULL for posting/reversing (the
// immutability-affecting operations) — Inventory has no dedicated
// permission resource yet, and PROCUREMENT is the closest existing one
// (goods/stock, the same operational area) rather than expanding the
// permission matrix as part of this pass.

type ActionState = { error: string } | { ok: true } | undefined;

function assertInventoryWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROCUREMENT", "WRITE")) throw new Error("Not authorized");
}
function assertInventoryFull(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROCUREMENT", "FULL")) throw new Error("Not authorized");
}

const CategorySchema = z.object({ code: z.string().min(1), name: z.string().min(1), parentId: z.string().optional() });

export async function createProductCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = CategorySchema.safeParse({ code: formData.get("code"), name: formData.get("name"), parentId: formData.get("parentId") || undefined });
  if (!parsed.success) return { error: "Enter a code and a name." };

  try {
    assertInventoryWrite(role);
    await createProductCategory(tenantId, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create category") };
  }
  revalidatePath("/dashboard/inventory/products");
  return { ok: true };
}

const UomSchema = z.object({ name: z.string().min(1), symbol: z.string().min(1), precision: z.coerce.number().optional() });

export async function createUnitOfMeasureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = UomSchema.safeParse({ name: formData.get("name"), symbol: formData.get("symbol"), precision: formData.get("precision") || undefined });
  if (!parsed.success) return { error: "Enter a name and a symbol." };

  try {
    assertInventoryWrite(role);
    await createUnitOfMeasure(tenantId, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create unit") };
  }
  revalidatePath("/dashboard/inventory/products");
  return { ok: true };
}

const ProductSchema = z.object({
  sku: z.string().min(1, "Enter a SKU"),
  name: z.string().min(1, "Enter a name"),
  categoryId: z.string().optional(),
  baseUomId: z.string().optional(),
  trackingType: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
});

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId") || undefined,
    baseUomId: formData.get("baseUomId") || undefined,
    trackingType: formData.get("trackingType") || undefined,
    barcode: formData.get("barcode") || undefined,
    brand: formData.get("brand") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertInventoryWrite(role);
    await createProduct(tenantId, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create product") };
  }
  revalidatePath("/dashboard/inventory/products");
  return { ok: true };
}

const WarehouseSchema = z.object({ code: z.string().min(1), name: z.string().min(1), address: z.string().optional(), managerId: z.string().optional() });

export async function createWarehouseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = WarehouseSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    managerId: formData.get("managerId") || undefined,
  });
  if (!parsed.success) return { error: "Enter a code and a name." };

  try {
    assertInventoryFull(role);
    await createWarehouse(tenantId, parsed.data);
  } catch (error) {
    return { error: toActionError(error, "Could not create warehouse") };
  }
  revalidatePath("/dashboard/inventory/warehouses");
  return { ok: true };
}

const MovementSchema = z.object({
  type: z.string().min(1),
  reason: z.string().optional(),
  projectId: z.string().optional(),
  recipientId: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.coerce.number().positive(),
        unitCost: z.coerce.number().optional(),  // decimal as typed; converted to minor units below
        fromWarehouseId: z.string().optional(),
        toWarehouseId: z.string().optional(),
        expiryDate: z.coerce.date().optional(),
      })
    )
    .min(1, "Add at least one line"),
});

export async function createMovementAction(
  _prev: ActionState,
  input: {
    type: string;
    reason?: string;
    projectId?: string;
    recipientId?: string;
    lines: { productId: string; qty: number; unitCost?: number; fromWarehouseId?: string; toWarehouseId?: string; expiryDate?: Date }[];
  }
): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = MovementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    assertInventoryWrite(role);
    // The sanctioned Float -> minor-units boundary: the form collects a decimal
    // cost, storage is integer minor units (lib/money.ts).
    const currency = await tenantDefaultCurrency(tenantId);
    const lines = parsed.data.lines.map(({ unitCost, ...line }) => ({
      ...line,
      unitCostMinor: unitCost == null ? undefined : toMinorUnits(unitCost, currency),
    }));
    await createMovement(tenantId, { ...parsed.data, lines, type: parsed.data.type as MovementType, createdById: user.id });
  } catch (error) {
    return { error: toActionError(error, "Could not create movement") };
  }
  revalidatePath("/dashboard/inventory/movements");
  revalidatePath("/dashboard/inventory/receiving");
  revalidatePath("/dashboard/inventory/issues");
  revalidatePath("/dashboard/inventory/transfers");
  revalidatePath("/dashboard/inventory/returns");
  return { ok: true };
}

export async function postMovementAction(movementId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryFull(role);
  await postMovement(tenantId, { movementId, actorId: user.id });
  revalidatePath("/dashboard/inventory/movements");
  revalidatePath(`/dashboard/inventory/movements/${movementId}`);
}

export async function reverseMovementAction(movementId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryFull(role);
  await reverseMovement(tenantId, { movementId, actorId: user.id });
  revalidatePath("/dashboard/inventory/movements");
  revalidatePath(`/dashboard/inventory/movements/${movementId}`);
}

// PRD_Inventory_Dashboard — confirmation is the named recipient's own act,
// not gated on PROCUREMENT:WRITE the way drafting/posting is; any signed-in
// user can confirm/dispute a movement addressed to them.
export async function confirmMovementReceiptAction(movementId: string) {
  const { tenantId, user } = await getCurrentUser();
  await confirmMovementReceipt(tenantId, user.id, movementId);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/issues");
  revalidatePath("/dashboard/inventory/transfers");
  revalidatePath(`/dashboard/inventory/movements/${movementId}`);
}

export async function disputeMovementReceiptAction(movementId: string, reason: string) {
  const { tenantId, user } = await getCurrentUser();
  await disputeMovementReceipt(tenantId, user.id, movementId, reason);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/issues");
  revalidatePath("/dashboard/inventory/transfers");
  revalidatePath(`/dashboard/inventory/movements/${movementId}`);
}
