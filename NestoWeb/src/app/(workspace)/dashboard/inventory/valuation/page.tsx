import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";

// §Valuation — onHand × the most recent posted unit cost this product has
// ever received at. Products with no cost history (unitCost never entered
// on a receiving line) are shown with a "—" rather than a fabricated cost.
export default async function ValuationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const balances = await db.stockBalance.findMany({
    where: { tenantId, onHand: { gt: 0 } },
    include: { product: { select: { id: true, sku: true, name: true } }, warehouse: { select: { id: true, code: true } } },
  });

  const lastCosts = await Promise.all(
    balances.map((b) =>
      db.movementLine.findFirst({
        where: { tenantId, productId: b.productId, unitCost: { not: null }, movement: { status: "POSTED" } },
        orderBy: { id: "desc" },
        select: { unitCost: true },
      })
    )
  );

  const rows = balances.map((b, i) => ({
    ...b,
    unitCost: lastCosts[i]?.unitCost ?? null,
    value: lastCosts[i]?.unitCost != null ? lastCosts[i]!.unitCost! * b.onHand : null,
  }));
  const totalValue = rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.valuation")}</CardTitle>
            <CardDescription>{t("inventoryModule.valuationSubtitle")}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-faint">{t("dashboards.inventory.totalOnHand")}</p>
            <p className="text-lg font-semibold text-ink">{totalValue.toFixed(2)}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH>{t("inventoryModule.warehouse")}</TH><TH className="text-right">{t("dashboards.inventory.onHand")}</TH><TH className="text-right">{t("inventoryModule.unitCost")}</TH><TH className="text-right">{t("common.total")}</TH></TRow></THead>
            <TBody>
              {rows.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.product.sku} — {r.product.name}</TD>
                  <TD className="text-ink-muted">{r.warehouse.code}</TD>
                  <TD className="text-right text-ink">{r.onHand}</TD>
                  <TD className="text-right text-ink-muted">{r.unitCost ?? "—"}</TD>
                  <TD className="text-right text-ink">{r.value != null ? r.value.toFixed(2) : "—"}</TD>
                </TRow>
              ))}
              {rows.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
