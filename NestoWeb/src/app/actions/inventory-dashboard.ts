"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createReservation,
  cancelReservation,
  fulfillReservation,
  createCount,
  startCount,
  recordCountLine,
  submitCount,
  approveCount,
  cancelCount,
  setReorderLevels,
  confirmDailyClose,
} from "@/server/inventory-dashboard";

type ActionState = { error: string } | { ok: true } | undefined;

function assertInventoryWrite(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROCUREMENT", "WRITE")) throw new Error("Not authorized");
}
function assertInventoryFull(role: Parameters<typeof can>[0]) {
  if (!can(role, "PROCUREMENT", "FULL")) throw new Error("Not authorized");
}

const ReservationSchema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.coerce.number().positive(),
  projectId: z.string().optional(),
  purpose: z.string().optional(),
});

export async function createReservationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = ReservationSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    productId: formData.get("productId"),
    qty: formData.get("qty"),
    projectId: formData.get("projectId") || undefined,
    purpose: formData.get("purpose") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertInventoryWrite(role);
    await createReservation(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create reservation" };
  }
  revalidatePath("/dashboard/inventory/reservations");
  return { ok: true };
}

export async function cancelReservationAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await cancelReservation(tenantId, user.id, id);
  revalidatePath("/dashboard/inventory/reservations");
}

export async function fulfillReservationAction(id: string, movementId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await fulfillReservation(tenantId, user.id, { id, movementId });
  revalidatePath("/dashboard/inventory/reservations");
}

const CountSchema = z.object({
  warehouseId: z.string().min(1),
  type: z.enum(["CYCLE", "PHYSICAL"]),
  blind: z.coerce.boolean().optional(),
  productIds: z.array(z.string()).min(1, "Select at least one product"),
});

export async function createCountAction(_prev: ActionState, input: { warehouseId: string; type: "CYCLE" | "PHYSICAL"; blind?: boolean; productIds: string[] }): Promise<ActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const parsed = CountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertInventoryWrite(role);
    await createCount(tenantId, user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create count" };
  }
  revalidatePath("/dashboard/inventory/counts");
  return { ok: true };
}

export async function startCountAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await startCount(tenantId, user.id, id);
  revalidatePath(`/dashboard/inventory/counts/${id}`);
}

export async function recordCountLineAction(lineId: string, countedQty: number, varianceReason?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await recordCountLine(tenantId, user.id, { lineId, countedQty, varianceReason });
}

export async function submitCountAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await submitCount(tenantId, user.id, id);
  revalidatePath(`/dashboard/inventory/counts/${id}`);
}

export async function approveCountAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryFull(role);
  await approveCount(tenantId, user.id, id);
  revalidatePath(`/dashboard/inventory/counts/${id}`);
  revalidatePath("/dashboard/inventory");
}

export async function cancelCountAction(id: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await cancelCount(tenantId, user.id, id);
  revalidatePath(`/dashboard/inventory/counts/${id}`);
}

const ReorderSchema = z.object({ productId: z.string().min(1), warehouseId: z.string().min(1), reorderPoint: z.coerce.number().min(0), reorderQty: z.coerce.number().min(0) });

export async function setReorderLevelsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenantId, role } = await getCurrentUser();
  const parsed = ReorderSchema.safeParse({
    productId: formData.get("productId"),
    warehouseId: formData.get("warehouseId"),
    reorderPoint: formData.get("reorderPoint"),
    reorderQty: formData.get("reorderQty"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    assertInventoryWrite(role);
    await setReorderLevels(tenantId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not set reorder levels" };
  }
  revalidatePath("/dashboard/inventory/reorder");
  return { ok: true };
}

export async function confirmDailyCloseAction(id: string, notes?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  assertInventoryWrite(role);
  await confirmDailyClose(tenantId, user.id, id, notes);
  revalidatePath("/dashboard/inventory");
}
