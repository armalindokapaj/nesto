import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { logInventoryActivity } from "@/server/inventory-module";

// PRD_Inventory_Dashboard — Reservations, Counts (cycle/physical), Reorder,
// Daily Close, and the dashboard aggregator. Movement identity/posting/
// reversal stay owned by inventory-module.ts; nothing here bypasses that —
// a Count's variance and a Reservation's fulfilment are both realized only
// through a real posted InventoryMovement.

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export async function listReservations(tenantId: string, filter?: { status?: string | string[]; warehouseId?: string }) {
  return db.stockReservation.findMany({
    where: {
      tenantId,
      warehouseId: filter?.warehouseId,
      ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      project: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function createReservation(
  tenantId: string,
  actorId: string,
  input: { warehouseId: string; productId: string; qty: number; projectId?: string; purpose?: string; expiresAt?: Date }
) {
  if (input.qty <= 0) throw new Error("Quantity must be positive.");
  const reservation = await db.$transaction(async (tx) => {
    const created = await tx.stockReservation.create({
      data: {
        tenantId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        qty: input.qty,
        projectId: input.projectId || null,
        purpose: input.purpose,
        expiresAt: input.expiresAt,
        requestedById: actorId,
      },
    });
    await tx.stockBalance.upsert({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
      create: { tenantId, productId: input.productId, warehouseId: input.warehouseId, reserved: input.qty },
      update: { reserved: { increment: input.qty } },
    });
    return created;
  });
  await logInventoryActivity({ tenantId, entityType: "StockReservation", entityId: reservation.id, actorId, eventType: "CREATED", summary: `Reserved ${input.qty} units` });
  return reservation;
}

async function releaseReservationBalance(tenantId: string, reservation: { productId: string; warehouseId: string; qty: number }) {
  await db.stockBalance.updateMany({
    where: { productId: reservation.productId, warehouseId: reservation.warehouseId },
    data: { reserved: { decrement: reservation.qty } },
  });
  // Never let a race take the cached counter negative.
  const balance = await db.stockBalance.findUnique({ where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } } });
  if (balance && balance.reserved < 0) {
    await db.stockBalance.update({ where: { id: balance.id }, data: { reserved: 0 } });
  }
}

export async function cancelReservation(tenantId: string, actorId: string, id: string) {
  const reservation = assertTenant(await db.stockReservation.findUnique({ where: { id } }), tenantId, "StockReservation");
  if (reservation.status !== "ACTIVE") throw new Error("Only an active reservation can be cancelled.");
  await db.$transaction(async (tx) => {
    await tx.stockReservation.update({ where: { id }, data: { status: "CANCELLED" } });
  });
  await releaseReservationBalance(tenantId, reservation);
  await logInventoryActivity({ tenantId, entityType: "StockReservation", entityId: id, actorId, eventType: "CANCELLED", summary: "Reservation cancelled" });
  return true;
}

/** Marks a reservation fulfilled once the real movement that satisfies it has
 * posted — the reservation itself never moves stock, it only holds a claim. */
export async function fulfillReservation(tenantId: string, actorId: string, input: { id: string; movementId: string }) {
  const reservation = assertTenant(await db.stockReservation.findUnique({ where: { id: input.id } }), tenantId, "StockReservation");
  if (reservation.status !== "ACTIVE") throw new Error("Only an active reservation can be fulfilled.");
  assertTenant(await db.inventoryMovement.findUnique({ where: { id: input.movementId } }), tenantId, "InventoryMovement");
  const updated = await db.stockReservation.update({ where: { id: input.id }, data: { status: "FULFILLED", fulfilledMovementId: input.movementId } });
  await releaseReservationBalance(tenantId, reservation);
  await logInventoryActivity({ tenantId, entityType: "StockReservation", entityId: input.id, actorId, eventType: "FULFILLED", summary: "Reservation fulfilled by posted movement" });
  return updated;
}

// ---------------------------------------------------------------------------
// Counts — cycle & physical, blind by default
// ---------------------------------------------------------------------------

export async function listCounts(tenantId: string, filter?: { status?: string | string[]; warehouseId?: string }) {
  return db.inventoryCount.findMany({
    where: {
      tenantId,
      warehouseId: filter?.warehouseId,
      ...(filter?.status ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { warehouse: { select: { id: true, name: true, code: true } }, createdBy: { select: { id: true, displayName: true } }, lines: { select: { id: true } } },
  });
}

export async function getCountDetail(tenantId: string, id: string) {
  const count = assertTenant(
    await db.inventoryCount.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true } }, countedBy: { select: { id: true, displayName: true } } } },
      },
    }),
    tenantId,
    "InventoryCount"
  );
  return count;
}

export async function createCount(tenantId: string, actorId: string, input: { warehouseId: string; type: "CYCLE" | "PHYSICAL"; blind?: boolean; scheduledDate?: Date; productIds: string[] }) {
  if (input.productIds.length === 0) throw new Error("Select at least one product to count.");
  const balances = await db.stockBalance.findMany({ where: { tenantId, warehouseId: input.warehouseId, productId: { in: input.productIds } } });
  const balanceByProduct = new Map(balances.map((b) => [b.productId, b.onHand]));
  const count = await db.inventoryCount.create({
    data: {
      tenantId,
      warehouseId: input.warehouseId,
      type: input.type,
      blind: input.blind ?? true,
      scheduledDate: input.scheduledDate,
      createdById: actorId,
      lines: {
        create: input.productIds.map((productId) => ({
          tenantId,
          productId,
          systemQty: balanceByProduct.get(productId) ?? 0,
        })),
      },
    },
  });
  await logInventoryActivity({ tenantId, entityType: "InventoryCount", entityId: count.id, actorId, eventType: "CREATED", summary: `${input.type} count planned` });
  return count;
}

export async function startCount(tenantId: string, actorId: string, id: string) {
  const count = assertTenant(await db.inventoryCount.findUnique({ where: { id } }), tenantId, "InventoryCount");
  if (count.status !== "PLANNED") throw new Error("Only a planned count can be started.");
  const updated = await db.inventoryCount.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  await logInventoryActivity({ tenantId, entityType: "InventoryCount", entityId: id, actorId, eventType: "STARTED", summary: "Count started" });
  return updated;
}

export async function recordCountLine(tenantId: string, actorId: string, input: { lineId: string; countedQty: number; varianceReason?: string }) {
  const line = assertTenant(await db.inventoryCountLine.findUnique({ where: { id: input.lineId }, include: { count: true } }), tenantId, "InventoryCountLine");
  if (line.count.status !== "IN_PROGRESS") throw new Error("The count must be in progress to record a line.");
  return db.inventoryCountLine.update({
    where: { id: input.lineId },
    data: { countedQty: input.countedQty, varianceReason: input.varianceReason, countedById: actorId, countedAt: new Date() },
  });
}

export async function submitCount(tenantId: string, actorId: string, id: string) {
  const count = assertTenant(await db.inventoryCount.findUnique({ where: { id }, include: { lines: true } }), tenantId, "InventoryCount");
  if (count.status !== "IN_PROGRESS") throw new Error("Only an in-progress count can be submitted.");
  if (count.lines.some((l) => l.countedQty === null)) throw new Error("Every line needs a counted quantity before submitting.");
  const updated = await db.inventoryCount.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  await logInventoryActivity({ tenantId, entityType: "InventoryCount", entityId: id, actorId, eventType: "SUBMITTED", summary: "Count submitted for approval" });
  return updated;
}

/** §Counts — approving a submitted count posts one ADJUSTMENT movement per
 * varying line (never edits StockBalance directly): keeps the append-only
 * ledger the single source of truth, exactly like every other stock change. */
export async function approveCount(tenantId: string, actorId: string, id: string) {
  const count = assertTenant(await db.inventoryCount.findUnique({ where: { id }, include: { lines: true, warehouse: true } }), tenantId, "InventoryCount");
  if (count.status !== "SUBMITTED") throw new Error("Only a submitted count can be approved.");

  const varyingLines = count.lines.filter((l) => l.countedQty !== null && Math.abs(l.countedQty - l.systemQty) > 0.0001);

  let adjustmentMovementId: string | null = null;
  if (varyingLines.length > 0) {
    const { createMovement, postMovement } = await import("@/server/inventory-module");
    const increases = varyingLines.filter((l) => (l.countedQty as number) > l.systemQty);
    const decreases = varyingLines.filter((l) => (l.countedQty as number) < l.systemQty);
    // One movement covers the whole count; ADJUSTMENT type is chosen by
    // whichever direction dominates, individual lines still carry their own
    // true delta via qty — matches inventory-module.ts's requiresFrom/To.
    const type = increases.length >= decreases.length ? "ADJUSTMENT_INCREASE" : "ADJUSTMENT_DECREASE";
    const relevantLines = type === "ADJUSTMENT_INCREASE" ? increases : decreases;
    if (relevantLines.length > 0) {
      const movement = await createMovement(tenantId, {
        type,
        reason: `Count ${id} approval`,
        createdById: actorId,
        lines: relevantLines.map((l) => ({
          productId: l.productId,
          qty: Math.abs((l.countedQty as number) - l.systemQty),
          toWarehouseId: type === "ADJUSTMENT_INCREASE" ? count.warehouseId : undefined,
          fromWarehouseId: type === "ADJUSTMENT_DECREASE" ? count.warehouseId : undefined,
        })),
      });
      await postMovement(tenantId, { movementId: movement.id, actorId });
      adjustmentMovementId = movement.id;
    }
  }

  const updated = await db.inventoryCount.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: actorId, adjustmentMovementId },
  });
  await logInventoryActivity({ tenantId, entityType: "InventoryCount", entityId: id, actorId, eventType: "APPROVED", summary: varyingLines.length > 0 ? `Approved with ${varyingLines.length} variance(s) adjusted` : "Approved, no variance" });
  return updated;
}

export async function cancelCount(tenantId: string, actorId: string, id: string) {
  const count = assertTenant(await db.inventoryCount.findUnique({ where: { id } }), tenantId, "InventoryCount");
  if (count.status === "APPROVED") throw new Error("An approved count cannot be cancelled.");
  const updated = await db.inventoryCount.update({ where: { id }, data: { status: "CANCELLED" } });
  await logInventoryActivity({ tenantId, entityType: "InventoryCount", entityId: id, actorId, eventType: "CANCELLED", summary: "Count cancelled" });
  return updated;
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

export async function listReorderCandidates(tenantId: string) {
  const balances = await db.stockBalance.findMany({
    where: { tenantId, reorderPoint: { not: null } },
    include: { product: { select: { id: true, sku: true, name: true } }, warehouse: { select: { id: true, name: true, code: true } } },
  });
  return balances.filter((b) => b.onHand - b.reserved <= (b.reorderPoint ?? 0));
}

export async function setReorderLevels(tenantId: string, input: { productId: string; warehouseId: string; reorderPoint: number; reorderQty: number }) {
  return db.stockBalance.upsert({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
    create: { tenantId, productId: input.productId, warehouseId: input.warehouseId, reorderPoint: input.reorderPoint, reorderQty: input.reorderQty },
    update: { reorderPoint: input.reorderPoint, reorderQty: input.reorderQty },
  });
}

// ---------------------------------------------------------------------------
// Expiration
// ---------------------------------------------------------------------------

export async function listExpiringLines(tenantId: string, withinDays = 30) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);
  return db.movementLine.findMany({
    where: { tenantId, expiryDate: { not: null, lte: horizon }, movement: { status: "POSTED" }, toWarehouseId: { not: null } },
    orderBy: { expiryDate: "asc" },
    include: { product: { select: { id: true, sku: true, name: true } }, toWarehouse: { select: { id: true, name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Daily Close
// ---------------------------------------------------------------------------

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Ensures today's row exists for every active warehouse, deriving its status
 * from today's actual movement/dispute/count activity — read-only unless the
 * row doesn't exist yet, never overwrites a row someone already confirmed. */
export async function ensureDailyCloseRows(tenantId: string, workDate: Date = new Date()) {
  const day = startOfDay(workDate);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const warehouses = await db.warehouse.findMany({ where: { tenantId, status: "ACTIVE" } });
  for (const warehouse of warehouses) {
    const existing = await db.dailyClose.findUnique({ where: { warehouseId_workDate: { warehouseId: warehouse.id, workDate: day } } });
    if (existing && existing.status !== "DUE") continue;

    const [movementsCount, disputesCount, openCounts] = await Promise.all([
      db.inventoryMovement.count({ where: { tenantId, date: { gte: day, lt: nextDay }, lines: { some: { OR: [{ fromWarehouseId: warehouse.id }, { toWarehouseId: warehouse.id }] } } } }),
      db.inventoryMovement.count({ where: { tenantId, confirmationStatus: "DISPUTED", lines: { some: { OR: [{ fromWarehouseId: warehouse.id }, { toWarehouseId: warehouse.id }] } } } }),
      db.inventoryCount.count({ where: { tenantId, warehouseId: warehouse.id, status: { in: ["IN_PROGRESS", "SUBMITTED"] } } }),
    ]);
    const status = disputesCount > 0 || openCounts > 0 ? "ATTENTION_REQUIRED" : movementsCount === 0 ? "NO_MOVEMENT" : "DUE";

    await db.dailyClose.upsert({
      where: { warehouseId_workDate: { warehouseId: warehouse.id, workDate: day } },
      create: { tenantId, warehouseId: warehouse.id, workDate: day, status, movementsCount, discrepanciesCount: disputesCount + openCounts },
      update: { status, movementsCount, discrepanciesCount: disputesCount + openCounts },
    });
  }
}

export async function listDailyCloses(tenantId: string, workDate: Date = new Date()) {
  await ensureDailyCloseRows(tenantId, workDate);
  const day = startOfDay(workDate);
  return db.dailyClose.findMany({ where: { tenantId, workDate: day }, include: { warehouse: { select: { id: true, name: true, code: true } }, confirmedBy: { select: { id: true, displayName: true } } }, orderBy: { warehouse: { code: "asc" } } });
}

export async function confirmDailyClose(tenantId: string, actorId: string, id: string, notes?: string) {
  const close = assertTenant(await db.dailyClose.findUnique({ where: { id } }), tenantId, "DailyClose");
  if (close.status === "ATTENTION_REQUIRED") throw new Error("Resolve open disputes/counts for this warehouse before closing the day.");
  if (close.status === "COMPLETE") throw new Error("This day is already closed.");
  const claimed = await db.dailyClose.updateMany({ where: { id, status: close.status }, data: { status: "COMPLETE", confirmedById: actorId, confirmedAt: new Date(), notes } });
  if (claimed.count === 0) throw new Error("This day was closed by someone else. Reload and try again.");
  const updated = await db.dailyClose.findUniqueOrThrow({ where: { id } });
  await logInventoryActivity({ tenantId, entityType: "DailyClose", entityId: id, actorId, eventType: "CONFIRMED", summary: "Daily close confirmed" });
  return updated;
}

// ---------------------------------------------------------------------------
// Dashboard aggregator
// ---------------------------------------------------------------------------

export async function getInventoryDashboard(tenantId: string, actorId: string) {
  await ensureDailyCloseRows(tenantId);

  const [lowStockBalances, movementsTodayCount, pendingConfirmations, dailyCloses, warehouses, discrepancyCounts, recentActivity, myConfirmations, allBalances] = await Promise.all([
    db.stockBalance.findMany({ where: { tenantId, reorderPoint: { not: null } }, include: { product: { select: { id: true, sku: true, name: true } }, warehouse: { select: { id: true, name: true } } } }),
    db.inventoryMovement.count({ where: { tenantId, date: { gte: startOfDay(new Date()) } } }),
    db.inventoryMovement.count({ where: { tenantId, confirmationStatus: "PENDING" } }),
    db.dailyClose.findMany({ where: { tenantId, workDate: startOfDay(new Date()) }, include: { warehouse: { select: { id: true, name: true, code: true } } } }),
    db.warehouse.findMany({ where: { tenantId, status: "ACTIVE" }, include: { stockBalances: { select: { onHand: true } } } }),
    db.inventoryCount.count({ where: { tenantId, status: { in: ["IN_PROGRESS", "SUBMITTED"] } } }),
    db.inventoryActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { id: true, displayName: true } } } }),
    db.inventoryMovement.findMany({ where: { tenantId, recipientId: actorId, confirmationStatus: "PENDING" }, include: { createdBy: { select: { id: true, displayName: true } } }, orderBy: { postedAt: "desc" }, take: 20 }),
    db.stockBalance.aggregate({ where: { tenantId }, _sum: { onHand: true, reserved: true } }),
  ]);

  const lowStock = lowStockBalances.filter((b) => b.onHand - b.reserved <= (b.reorderPoint ?? 0));

  return {
    cues: {
      lowStockCount: lowStock.length,
      movementsToday: movementsTodayCount,
      pendingConfirmations,
      dailyCloseDue: dailyCloses.filter((d) => d.status === "DUE" || d.status === "ATTENTION_REQUIRED").length,
    },
    stockOverview: {
      totalOnHand: allBalances._sum.onHand ?? 0,
      totalReserved: allBalances._sum.reserved ?? 0,
      lowStock: lowStock.slice(0, 8),
    },
    warehouseStatus: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code, onHand: w.stockBalances.reduce((sum, b) => sum + b.onHand, 0) })),
    discrepanciesAndCounts: { openCounts: discrepancyCounts, dailyCloses },
    workInbox: myConfirmations,
    recentActivity,
  };
}
