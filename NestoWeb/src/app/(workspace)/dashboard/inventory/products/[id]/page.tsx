import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProductDetail } from "@/server/inventory-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const product = await getProductDetail(tenantId, id);
  const { t } = await getT();
  const totalOnHand = product.stockBalances.reduce((sum, b) => sum + b.onHand, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/inventory/products" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("inventoryModule.products")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{product.name}</CardTitle>
              <span className="font-mono text-xs text-ink-faint">{product.sku}</span>
              <Badge status={product.status}>{product.status}</Badge>
            </div>
            <CardDescription>
              {product.category?.name ?? "—"} · {product.baseUom?.symbol ?? t("inventoryModule.noUnit")} · {t("inventoryModule.trackingType")}: {product.trackingType}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-faint">{t("inventoryModule.totalOnHand")}</p>
            <p className="text-lg font-semibold text-ink">{totalOnHand}</p>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("inventoryModule.stockByWarehouse")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("inventoryModule.warehouse")}</TH>
                <TH className="text-right">{t("inventoryModule.onHand")}</TH>
                <TH className="text-right">{t("inventoryModule.reserved")}</TH>
                <TH className="text-right">{t("inventoryModule.available")}</TH>
              </TRow>
            </THead>
            <TBody>
              {product.stockBalances.map((b) => (
                <TRow key={b.id}>
                  <TD className="text-ink">{b.warehouse.name}</TD>
                  <TD className="text-right text-ink-muted">{b.onHand}</TD>
                  <TD className="text-right text-ink-muted">{b.reserved}</TD>
                  <TD className="text-right text-ink-muted">{b.onHand - b.reserved - b.blocked}</TD>
                </TRow>
              ))}
              {product.stockBalances.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-6 text-center text-ink-faint">
                    {t("inventoryModule.noStock")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("inventoryModule.recentMovements")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.journalNumber")}</TH>
                <TH>{t("inventoryModule.movementType")}</TH>
                <TH>{t("inventoryModule.fromWarehouse")}</TH>
                <TH>{t("inventoryModule.toWarehouse")}</TH>
                <TH className="text-right">{t("inventoryModule.qty")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {product.recentLines.map((line) => (
                <TRow key={line.id}>
                  <TD className="font-mono text-xs text-ink">
                    <Link href={`/dashboard/inventory/movements/${line.movement.id}`} className="hover:text-gold hover:underline">
                      {line.movement.number}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{t(`inventoryModule.movementType_${line.movement.type}`)}</TD>
                  <TD className="text-ink-muted">{line.fromWarehouse?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{line.toWarehouse?.name ?? "—"}</TD>
                  <TD className="text-right text-ink-muted">{line.qty}</TD>
                  <TD className="text-ink-muted">{line.movement.postedAt ? formatDate(line.movement.postedAt) : "—"}</TD>
                </TRow>
              ))}
              {product.recentLines.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-6 text-center text-ink-faint">
                    {t("inventoryModule.noMovements")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
