import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listCounts } from "@/server/inventory-dashboard";
import { listProducts, listWarehouses } from "@/server/inventory-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCountDialog } from "@/components/inventory/create-count-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function CountsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const [counts, products, warehouses] = await Promise.all([listCounts(tenantId), listProducts(tenantId), listWarehouses(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div><CardTitle>{t("inventoryModule.counts")}</CardTitle><CardDescription>{t("inventoryModule.countsSubtitle")}</CardDescription></div>
          {canWrite && (
            <CreateCountDialog
              warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
              products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("inventoryModule.warehouse")}</TH><TH>{t("inventoryModule.countType")}</TH><TH>{t("common.status")}</TH><TH>{t("inventoryModule.lines")}</TH><TH>{t("dashboards.admin.joined")}</TH></TRow></THead>
            <TBody>
              {counts.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-medium text-ink"><Link href={`/dashboard/inventory/counts/${c.id}`} className="hover:text-gold hover:underline">{c.warehouse.code}</Link></TD>
                  <TD className="text-ink-muted">{t(`inventoryModule.countType${c.type === "CYCLE" ? "Cycle" : "Physical"}`)}</TD>
                  <TD><Badge tone={c.status === "APPROVED" ? "success" : c.status === "CANCELLED" ? "neutral" : "warning"}>{t(`inventoryModule.countStatus_${c.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{c.lines.length}</TD>
                  <TD className="text-ink-muted">{formatDate(c.createdAt)}</TD>
                </TRow>
              ))}
              {counts.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
