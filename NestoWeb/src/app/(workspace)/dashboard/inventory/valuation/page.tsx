import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";
import { tenantDefaultCurrency } from "@/lib/tenant";
import { formatMinor } from "@/lib/money";

// §Valuation — onHand × the most recent posted unit cost this product has
// ever received at. Products with no cost history (unitCostMinor never entered
// on a receiving line) are shown with a "—" rather than a fabricated cost.
//
// Every figure here used to render as a bare `toFixed(2)` with no currency at
// all, which on a valuation table is ambiguous rather than merely unstyled.
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
        where: { tenantId, productId: b.productId, unitCostMinor: { not: null }, movement: { status: "POSTED" } },
        orderBy: { id: "desc" },
        select: { unitCostMinor: true },
      })
    )
  );

  const rows = balances.map((b, i) => {
    const unitCostMinor = lastCosts[i]?.unitCostMinor ?? null;
    return {
      ...b,
      unitCostMinor,
      // onHand is a fractional quantity, so the extended value lands back on a
      // whole minor unit rather than being left fractional and summed as such.
      valueMinor: unitCostMinor != null ? Math.round(unitCostMinor * b.onHand) : null,
    };
  });
  const totalValueMinor = rows.reduce((sum, r) => sum + (r.valueMinor ?? 0), 0);
  const currency = await tenantDefaultCurrency(tenantId);
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
            <p className="text-lg font-semibold text-ink">{formatMinor(totalValueMinor, currency)}</p>
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
                  <TD className="text-right text-ink-muted">{r.unitCostMinor != null ? formatMinor(r.unitCostMinor, currency) : "—"}</TD>
                  <TD className="text-right text-ink">{r.valueMinor != null ? formatMinor(r.valueMinor, currency) : "—"}</TD>
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
