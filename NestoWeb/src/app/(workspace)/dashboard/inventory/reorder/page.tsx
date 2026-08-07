import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { listReorderCandidates } from "@/server/inventory-dashboard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { ReorderForm } from "@/components/inventory/reorder-form";
import { getT } from "@/lib/i18n/server";

export default async function ReorderPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const candidates = await listReorderCandidates(tenantId);
  const { t } = await getT();

  // Every product/warehouse pair with stock, for setting new reorder levels
  // — not just the ones already below threshold.
  const balances = await db.stockBalance.findMany({
    where: { tenantId },
    include: { product: { select: { id: true, sku: true, name: true } }, warehouse: { select: { id: true, code: true } } },
    orderBy: { product: { sku: "asc" } },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("dashboards.inventory.lowStock")}</CardTitle><CardDescription>{t("inventoryModule.reorderSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH>{t("inventoryModule.warehouse")}</TH><TH className="text-right">{t("dashboards.inventory.available")}</TH><TH className="text-right">{t("inventoryModule.reorderPoint")}</TH><TH className="text-right">{t("inventoryModule.reorderQty")}</TH></TRow></THead>
            <TBody>
              {candidates.map((b) => (
                <TRow key={b.id}>
                  <TD className="font-medium text-ink">{b.product.sku} — {b.product.name}</TD>
                  <TD className="text-ink-muted">{b.warehouse.code}</TD>
                  <TD className="text-right text-danger">{b.onHand - b.reserved}</TD>
                  <TD className="text-right text-ink-muted">{b.reorderPoint}</TD>
                  <TD className="text-right text-ink-muted">{b.reorderQty}</TD>
                </TRow>
              ))}
              {candidates.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("dashboards.inventory.noLowStock")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader><CardTitle>{t("inventoryModule.setReorderLevels")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH>{t("inventoryModule.warehouse")}</TH><TH>{t("common.actions")}</TH></TRow></THead>
              <TBody>
                {balances.map((b) => (
                  <TRow key={b.id}>
                    <TD className="text-ink">{b.product.sku} — {b.product.name}</TD>
                    <TD className="text-ink-muted">{b.warehouse.code}</TD>
                    <TD><ReorderForm productId={b.product.id} warehouseId={b.warehouse.id} reorderPoint={b.reorderPoint} reorderQty={b.reorderQty} /></TD>
                  </TRow>
                ))}
                {balances.length === 0 && <TRow><TD colSpan={3} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
