import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";

export default async function StockLevelsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const balances = await db.stockBalance.findMany({
    where: { tenantId },
    include: { product: { select: { id: true, sku: true, name: true } }, warehouse: { select: { id: true, name: true, code: true } } },
    orderBy: { product: { sku: "asc" } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("inventoryModule.stockLevels")}</CardTitle>
            <CardDescription>{t("inventoryModule.stockLevelsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("inventoryModule.product")}</TH>
                <TH>{t("inventoryModule.warehouse")}</TH>
                <TH>{t("dashboards.inventory.onHand")}</TH>
                <TH>{t("dashboards.inventory.reserved")}</TH>
                <TH>{t("dashboards.inventory.available")}</TH>
              </TRow>
            </THead>
            <TBody>
              {balances.map((b) => (
                <TRow key={b.id}>
                  <TD className="font-medium text-ink">{b.product.sku} — {b.product.name}</TD>
                  <TD className="text-ink-muted">{b.warehouse.code}</TD>
                  <TD className="text-ink">{b.onHand}</TD>
                  <TD className="text-ink-muted">{b.reserved}</TD>
                  <TD className="text-ink">{b.onHand - b.reserved}</TD>
                </TRow>
              ))}
              {balances.length === 0 && (
                <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
