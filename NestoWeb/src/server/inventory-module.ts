import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { MOVEMENT_DIRECTION, type MovementType } from "@/lib/inventory-constants";

// PRD_Inventory_Module — Product master, Warehouses, and the append-only
// Movement ledger with derived StockBalance. §65 Data Ownership Rules:
// Inventory owns stock identity/quantity/location/movements; Procurement
// (Supplier/PurchaseOrder/ProcurementDelivery, built separately) is
// referenced by bare sourceModule/sourceId on a Receipt movement, never a
// Prisma relation. Movement posting/reversal deliberately mirrors
// src/server/finance-module.ts's JournalEntry (same immutable-once-posted,
// reverse-not-edit guarantee) — see the schema comment above ProductCategory.

export { PRODUCT_TRACKING_TYPES, PRODUCT_STATUSES, MOVEMENT_TYPES, MOVEMENT_STATUSES, MOVEMENT_DIRECTION } from "@/lib/inventory-constants";

export async function logInventoryActivity(input: { tenantId: string; entityType: string; entityId: string; actorId?: string | null; eventType: string; summary: string }) {
  await db.inventoryActivity.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
    },
  });
}

/** Local, self-contained sequence — same reasoning as Finance's
 * allocateJournalNumber: avoids touching number-series.ts's SERIES_CONFIG,
 * a file with concurrent, uncommitted edits from other in-progress work. */
async function allocateMovementNumber(tenantId: string): Promise<string> {
  const entityType = "INVENTORY_MOVEMENT";
  const year = new Date().getFullYear();
  const sequence = await db.$transaction(async (tx) => {
    const existing = await tx.numberSeries.findUnique({ where: { tenantId_entityType: { tenantId, entityType } } });
    if (!existing) {
      await tx.numberSeries.create({ data: { tenantId, entityType, prefix: "MV", nextValue: 2 } });
      return 1;
    }
    await tx.numberSeries.update({ where: { id: existing.id }, data: { nextValue: { increment: 1 } } });
    return existing.nextValue;
  });
  return `MV-${year}-${String(sequence).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Product Categories / Units of Measure
// ---------------------------------------------------------------------------

export async function listProductCategories(tenantId: string) {
  return db.productCategory.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
}

export async function createProductCategory(tenantId: string, input: { code: string; name: string; parentId?: string }) {
  const code = input.code.trim();
  const existing = await db.productCategory.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw new Error(`Category code ${code} is already in use.`);
  return db.productCategory.create({ data: { tenantId, code, name: input.name.trim(), parentId: input.parentId || null } });
}

export async function listUnitsOfMeasure(tenantId: string) {
  return db.unitOfMeasure.findMany({ where: { tenantId }, orderBy: { symbol: "asc" } });
}

export async function createUnitOfMeasure(tenantId: string, input: { name: string; symbol: string; precision?: number }) {
  const symbol = input.symbol.trim();
  const existing = await db.unitOfMeasure.findUnique({ where: { tenantId_symbol: { tenantId, symbol } } });
  if (existing) throw new Error(`Unit ${symbol} is already in use.`);
  return db.unitOfMeasure.create({ data: { tenantId, name: input.name.trim(), symbol, precision: input.precision ?? 0 } });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(tenantId: string) {
  return db.product.findMany({
    where: { tenantId },
    orderBy: { sku: "asc" },
    include: { category: { select: { id: true, name: true } }, baseUom: { select: { id: true, symbol: true } } },
  });
}

export async function createProduct(
  tenantId: string,
  input: { sku: string; name: string; description?: string; categoryId?: string; baseUomId?: string; trackingType?: string; barcode?: string; brand?: string }
) {
  const sku = input.sku.trim();
  const existing = await db.product.findUnique({ where: { tenantId_sku: { tenantId, sku } } });
  if (existing) throw new Error(`SKU ${sku} is already in use.`);
  return db.product.create({
    data: {
      tenantId,
      sku,
      name: input.name.trim(),
      description: input.description,
      categoryId: input.categoryId || null,
      baseUomId: input.baseUomId || null,
      trackingType: input.trackingType ?? "NONE",
      barcode: input.barcode,
      brand: input.brand,
    },
  });
}

export async function getProductDetail(tenantId: string, productId: string) {
  const product = assertTenant(
    await db.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        baseUom: true,
        stockBalances: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
      },
    }),
    tenantId,
    "Product"
  );
  const recentLines = await db.movementLine.findMany({
    where: { tenantId, productId, movement: { status: "POSTED" } },
    orderBy: { id: "desc" },
    take: 20,
    include: {
      movement: { select: { id: true, number: true, type: true, date: true, postedAt: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
    },
  });
  return { ...product, recentLines };
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export async function listWarehouses(tenantId: string) {
  return db.warehouse.findMany({ where: { tenantId }, orderBy: { code: "asc" }, include: { manager: { select: { id: true, displayName: true } } } });
}

export async function createWarehouse(tenantId: string, input: { code: string; name: string; address?: string; managerId?: string }) {
  const code = input.code.trim();
  const existing = await db.warehouse.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw new Error(`Warehouse code ${code} is already in use.`);
  return db.warehouse.create({ data: { tenantId, code, name: input.name.trim(), address: input.address, managerId: input.managerId || null } });
}

// ---------------------------------------------------------------------------
// Stock Movements — the append-only ledger
// ---------------------------------------------------------------------------

export async function listMovements(tenantId: string, filter?: { confirmationStatus?: string | string[] }) {
  return db.inventoryMovement.findMany({
    where: { tenantId, ...(filter?.confirmationStatus ? { confirmationStatus: Array.isArray(filter.confirmationStatus) ? { in: filter.confirmationStatus } : filter.confirmationStatus } : {}) },
    orderBy: { date: "desc" },
    include: {
      createdBy: { select: { id: true, displayName: true } },
      recipient: { select: { id: true, displayName: true } },
      lines: { select: { id: true, productId: true, qty: true } },
    },
  });
}

export async function getMovementDetail(tenantId: string, movementId: string) {
  const movement = assertTenant(
    await db.inventoryMovement.findUnique({
      where: { id: movementId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarColor: true } },
        postedBy: { select: { id: true, displayName: true } },
        recipient: { select: { id: true, displayName: true } },
        confirmedBy: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true } },
        reversesMovement: { select: { id: true, number: true } },
        reversedBy: { select: { id: true, number: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            uom: { select: { symbol: true } },
            fromWarehouse: { select: { id: true, name: true } },
            toWarehouse: { select: { id: true, name: true } },
          },
        },
      },
    }),
    tenantId,
    "InventoryMovement"
  );
  const activity = await db.inventoryActivity.findMany({
    where: { tenantId, entityType: "InventoryMovement", entityId: movementId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, displayName: true, avatarColor: true } } },
  });
  return { ...movement, activity };
}

export async function createMovement(
  tenantId: string,
  input: {
    type: MovementType;
    reason?: string;
    createdById: string;
    projectId?: string;
    // PRD_Inventory_Dashboard — Tagged Goods Issue / Transfer Receipt: naming
    // a recipient puts the movement into PENDING confirmation on posting.
    recipientId?: string;
    lines: { productId: string; qty: number; unitCostMinor?: number; fromWarehouseId?: string; toWarehouseId?: string; expiryDate?: Date }[];
  }
) {
  const direction = MOVEMENT_DIRECTION[input.type];
  if (!direction) throw new Error(`Unknown movement type "${input.type}".`);
  const validLines = input.lines.filter((l) => l.productId && l.qty > 0);
  if (validLines.length === 0) throw new Error("Add at least one line.");
  for (const line of validLines) {
    if (direction.requiresFrom && !line.fromWarehouseId) throw new Error("Every line needs a source warehouse for this movement type.");
    if (direction.requiresTo && !line.toWarehouseId) throw new Error("Every line needs a destination warehouse for this movement type.");
  }

  const number = await allocateMovementNumber(tenantId);
  const movement = await db.inventoryMovement.create({
    data: {
      tenantId,
      number,
      type: input.type,
      reason: input.reason,
      createdById: input.createdById,
      projectId: input.projectId || null,
      recipientId: input.recipientId || null,
      lines: {
        create: validLines.map((l) => ({
          tenantId,
          productId: l.productId,
          qty: l.qty,
          unitCostMinor: l.unitCostMinor,
          fromWarehouseId: direction.requiresFrom ? l.fromWarehouseId : null,
          toWarehouseId: direction.requiresTo ? l.toWarehouseId : null,
          expiryDate: l.expiryDate,
        })),
      },
    },
  });

  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: movement.id, actorId: input.createdById, eventType: "CREATED", summary: `Movement ${movement.number} created` });
  return movement;
}

/** Replays every movement line that has ever actually taken effect for one
 * product+warehouse and upserts the cached balance — the "always
 * reproducible" guarantee §21 asks for, rather than incremental math that
 * could drift.
 *
 * Includes POSTED *and* REVERSED movements, not POSTED alone: a REVERSED
 * movement's goods genuinely moved and its line must keep counting — the
 * cancellation comes entirely from the separate reversal movement's own
 * opposite-direction line (its status is POSTED). Filtering REVERSED out
 * here would double-cancel: once by excluding the original, again via the
 * reversal's offsetting line. Only DRAFT/CANCELLED movements — which never
 * took effect — are excluded. */
async function recomputeStockBalance(tenantId: string, productId: string, warehouseId: string) {
  const [inSum, outSum] = await Promise.all([
    db.movementLine.aggregate({
      where: { tenantId, productId, toWarehouseId: warehouseId, movement: { status: { in: ["POSTED", "REVERSED"] } } },
      _sum: { qty: true },
    }),
    db.movementLine.aggregate({
      where: { tenantId, productId, fromWarehouseId: warehouseId, movement: { status: { in: ["POSTED", "REVERSED"] } } },
      _sum: { qty: true },
    }),
  ]);
  const onHand = (inSum._sum.qty ?? 0) - (outSum._sum.qty ?? 0);

  await db.stockBalance.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { tenantId, productId, warehouseId, onHand },
    update: { onHand },
  });
  return onHand;
}

/** §24 INV-MOV-002 "Posted stock movements are immutable." Validates a
 * decreasing line never takes on-hand negative, then posts and recomputes
 * every touched (product, warehouse) balance. */
export async function postMovement(tenantId: string, input: { movementId: string; actorId: string }) {
  const movement = assertTenant(
    await db.inventoryMovement.findUnique({ where: { id: input.movementId }, include: { lines: true } }),
    tenantId,
    "InventoryMovement"
  );
  if (movement.status === "POSTED") throw new Error("This movement is already posted.");
  if (movement.status === "REVERSED" || movement.status === "CANCELLED") throw new Error(`A ${movement.status.toLowerCase()} movement cannot be posted.`);
  if (movement.lines.length === 0) throw new Error("Add at least one line before posting.");

  // Reject any line that would take a warehouse's on-hand below zero.
  for (const line of movement.lines) {
    if (!line.fromWarehouseId) continue;
    const current = await db.stockBalance.findUnique({ where: { productId_warehouseId: { productId: line.productId, warehouseId: line.fromWarehouseId } } });
    const onHand = current?.onHand ?? 0;
    if (onHand - line.qty < -0.0001) {
      throw new Error(`Not enough stock: only ${onHand} on hand for this product at the source warehouse.`);
    }
  }

  // PRD_Inventory_Dashboard — a recipient-tagged ISSUE/TRANSFER only enters
  // PENDING confirmation once the goods have actually moved (posted), never
  // at draft time; RECEIPT/ADJUSTMENT movements never need confirmation.
  const needsConfirmation = !!movement.recipientId && (movement.type === "ISSUE" || movement.type === "TRANSFER");
  const posted = await db.inventoryMovement.update({
    where: { id: movement.id },
    data: {
      status: "POSTED",
      postedAt: new Date(),
      postedById: input.actorId,
      confirmationStatus: needsConfirmation ? "PENDING" : movement.confirmationStatus,
    },
  });

  const touched = new Set<string>();
  for (const line of movement.lines) {
    if (line.fromWarehouseId) touched.add(`${line.productId}::${line.fromWarehouseId}`);
    if (line.toWarehouseId) touched.add(`${line.productId}::${line.toWarehouseId}`);
  }
  for (const key of touched) {
    const [productId, warehouseId] = key.split("::");
    await recomputeStockBalance(tenantId, productId!, warehouseId!);
  }

  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: movement.id, actorId: input.actorId, eventType: "POSTED", summary: `Movement ${movement.number} posted` });
  return posted;
}

/** A posted movement is never edited — reversing creates a brand-new,
 * already-posted movement with every line's from/to warehouse swapped,
 * linked back via reversesMovementId, and flips the original to REVERSED. */
export async function reverseMovement(tenantId: string, input: { movementId: string; actorId: string; reason?: string }) {
  const movement = assertTenant(
    await db.inventoryMovement.findUnique({ where: { id: input.movementId }, include: { lines: true } }),
    tenantId,
    "InventoryMovement"
  );
  if (movement.status !== "POSTED") throw new Error("Only a posted movement can be reversed.");

  const number = await allocateMovementNumber(tenantId);
  const reversal = await db.$transaction(async (tx) => {
    const created = await tx.inventoryMovement.create({
      data: {
        tenantId,
        number,
        type: movement.type,
        reason: `Reversal of ${movement.number}${input.reason ? `: ${input.reason}` : ""}`,
        sourceModule: movement.sourceModule,
        sourceId: movement.sourceId,
        status: "POSTED",
        postedAt: new Date(),
        postedById: input.actorId,
        createdById: input.actorId,
        reversesMovementId: movement.id,
        lines: {
          create: movement.lines.map((l) => ({
            tenantId,
            productId: l.productId,
            qty: l.qty,
            unitCostMinor: l.unitCostMinor,
            uomId: l.uomId,
            fromWarehouseId: l.toWarehouseId,
            toWarehouseId: l.fromWarehouseId,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.inventoryMovement.update({ where: { id: movement.id }, data: { status: "REVERSED" } });
    return created;
  });

  const touched = new Set<string>();
  for (const line of [...movement.lines, ...reversal.lines]) {
    if (line.fromWarehouseId) touched.add(`${line.productId}::${line.fromWarehouseId}`);
    if (line.toWarehouseId) touched.add(`${line.productId}::${line.toWarehouseId}`);
  }
  for (const key of touched) {
    const [productId, warehouseId] = key.split("::");
    await recomputeStockBalance(tenantId, productId!, warehouseId!);
  }

  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: movement.id, actorId: input.actorId, eventType: "REVERSED", summary: `Reversed by ${reversal.number}` });
  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: reversal.id, actorId: input.actorId, eventType: "CREATED", summary: `Reversal of ${movement.number}, posted automatically` });
  return reversal;
}

// ---------------------------------------------------------------------------
// PRD_Inventory_Dashboard — Tagged Goods Issue / Transfer Receipt confirmation.
// A named recipient must acknowledge receipt (or dispute it); the underlying
// posted movement is never reversed by a confirmation/dispute — disputes are
// resolved by a human raising a separate reversing/adjustment movement, same
// as any other posted-movement correction.
// ---------------------------------------------------------------------------

export async function confirmMovementReceipt(tenantId: string, actorId: string, movementId: string) {
  const movement = assertTenant(await db.inventoryMovement.findUnique({ where: { id: movementId } }), tenantId, "InventoryMovement");
  if (movement.confirmationStatus !== "PENDING" && movement.confirmationStatus !== "DISPUTED") {
    throw new Error("This movement is not awaiting confirmation.");
  }
  if (movement.recipientId && movement.recipientId !== actorId) {
    throw new Error("Only the named recipient can confirm this movement.");
  }
  // Compare-and-swap, not a bare update: two recipients (or a double-submit)
  // could both read PENDING and both write, confirming the same receipt twice.
  const claimed = await db.inventoryMovement.updateMany({
    where: { id: movementId, confirmationStatus: movement.confirmationStatus },
    data: { confirmationStatus: "CONFIRMED", confirmedAt: new Date(), confirmedById: actorId, disputeReason: null },
  });
  if (claimed.count === 0) throw new Error("This movement was changed by someone else. Reload and try again.");
  const updated = await db.inventoryMovement.findUniqueOrThrow({ where: { id: movementId } });
  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: movementId, actorId, eventType: "CONFIRMED", summary: `${movement.number} receipt confirmed` });
  return updated;
}

export async function disputeMovementReceipt(tenantId: string, actorId: string, movementId: string, reason: string) {
  const movement = assertTenant(await db.inventoryMovement.findUnique({ where: { id: movementId } }), tenantId, "InventoryMovement");
  if (movement.confirmationStatus !== "PENDING") throw new Error("This movement is not awaiting confirmation.");
  if (movement.recipientId && movement.recipientId !== actorId) throw new Error("Only the named recipient can dispute this movement.");
  if (!reason.trim()) throw new Error("A dispute reason is required.");
  const claimed = await db.inventoryMovement.updateMany({
    where: { id: movementId, confirmationStatus: "PENDING" },
    data: { confirmationStatus: "DISPUTED", disputeReason: reason.trim() },
  });
  if (claimed.count === 0) throw new Error("This movement was changed by someone else. Reload and try again.");
  const updated = await db.inventoryMovement.findUniqueOrThrow({ where: { id: movementId } });
  await logInventoryActivity({ tenantId, entityType: "InventoryMovement", entityId: movementId, actorId, eventType: "DISPUTED", summary: `${movement.number} disputed: ${reason.trim()}` });
  return updated;
}
