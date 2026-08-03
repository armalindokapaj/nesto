import { db } from "@/lib/db";
import { allocateNumber } from "@/server/number-series";
import { assertTenant, requireTenantProject, requireTenantSupplier } from "@/lib/tenant";

export async function getProcurementDashboardData(tenantId: string) {
  const [suppliers, purchaseOrders] = await Promise.all([
    db.supplier.findMany({ where: { tenantId } }),
    db.purchaseOrder.findMany({
      where: { tenantId },
      include: { supplier: true, project: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const openOrders = purchaseOrders.filter((po) => !["RECEIVED", "CANCELLED"].includes(po.status));
  const pendingApproval = purchaseOrders.filter((po) => po.status === "SUBMITTED");
  const committedSpend = purchaseOrders
    .filter((po) => ["APPROVED", "ORDERED", "RECEIVED"].includes(po.status))
    .reduce((sum, po) => sum + po.amount, 0);

  return {
    totalSuppliers: suppliers.length,
    openOrdersCount: openOrders.length,
    pendingApprovalCount: pendingApproval.length,
    committedSpend,
    recentOrders: purchaseOrders.slice(0, 5),
    recentSuppliers: suppliers.slice(0, 5),
  };
}

export async function listSuppliers(tenantId: string) {
  return db.supplier.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}

export async function createSupplier(
  tenantId: string,
  input: { name: string; category: string; email?: string; phone?: string }
) {
  const number = await allocateNumber(tenantId, "SUPPLIER");
  return db.supplier.create({ data: { tenantId, number, ...input } });
}

export async function listPurchaseOrders(tenantId: string) {
  return db.purchaseOrder.findMany({
    where: { tenantId },
    include: { supplier: true, project: true, requestedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPurchaseOrder(
  tenantId: string,
  requestedById: string,
  input: { supplierId: string; projectId?: string; description: string; amount: number; currency?: string }
) {
  await Promise.all([
    requireTenantSupplier(tenantId, input.supplierId),
    input.projectId ? requireTenantProject(tenantId, input.projectId) : null,
  ]);

  const number = await allocateNumber(tenantId, "PURCHASE_ORDER");
  return db.purchaseOrder.create({ data: { tenantId, number, requestedById, ...input } });
}

export async function updatePurchaseOrderStatus(tenantId: string, purchaseOrderId: string, status: string) {
  const po = assertTenant(await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId } }), tenantId, "PurchaseOrder");
  return db.purchaseOrder.update({ where: { id: po.id }, data: { status } });
}
