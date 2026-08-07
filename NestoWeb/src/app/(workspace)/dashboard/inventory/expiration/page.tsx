import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listExpiringLines } from "@/server/inventory-dashboard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ExpirationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const lines = await listExpiringLines(tenantId, 30);
  const { t } = await getT();
  const now = new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.expiration")}</CardTitle><CardDescription>{t("inventoryModule.expirationSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH>{t("inventoryModule.warehouse")}</TH><TH className="text-right">{t("inventoryModule.qty")}</TH><TH>{t("inventoryModule.expiryDate")}</TH><TH>{t("common.status")}</TH></TRow></THead>
            <TBody>
              {lines.map((line) => {
                const expired = line.expiryDate! < now;
                return (
                  <TRow key={line.id}>
                    <TD className="font-medium text-ink">{line.product.sku} — {line.product.name}</TD>
                    <TD className="text-ink-muted">{line.toWarehouse?.name ?? "—"}</TD>
                    <TD className="text-right text-ink">{line.qty}</TD>
                    <TD className="text-ink-muted">{formatDate(line.expiryDate!)}</TD>
                    <TD><Badge tone={expired ? "danger" : "warning"}>{expired ? t("inventoryModule.expired") : t("inventoryModule.expiringSoon")}</Badge></TD>
                  </TRow>
                );
              })}
              {lines.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
