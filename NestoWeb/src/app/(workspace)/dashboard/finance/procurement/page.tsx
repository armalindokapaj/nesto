import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProcurementFinancePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const orders = await db.purchaseOrder.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { project: { select: { name: true } }, supplier: { select: { name: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.procurementFinanceTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.supplier")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {orders.map((o) => (
                <TRow key={o.id}>
                  <TD>
                    <p className="font-medium text-ink">{o.number}</p>
                    <p className="text-xs text-ink-muted">{o.title}</p>
                  </TD>
                  <TD className="text-ink-muted">{o.project?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{o.supplier.name}</TD>
                  <TD className="text-ink-muted">{formatCurrency(o.amount, o.currency)}</TD>
                  <TD>
                    <Badge status={o.status}>{o.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {orders.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    —
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
