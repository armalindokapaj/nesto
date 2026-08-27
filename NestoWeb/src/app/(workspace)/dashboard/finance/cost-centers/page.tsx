import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §13.1 "Financial dimensions ... remain separate from the Chart of
// Accounts." v1 keeps Cost Center as a free-text dimension on Budget/
// SpendingBill (matches the Client/Team Type convention elsewhere in this
// app) rather than a full dimension-hierarchy engine — this page is the
// rollup of whatever cost centers have actually been used.
export default async function CostCentersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const bills = await db.spendingBill.findMany({ where: { tenantId, costCenter: { not: null } }, select: { costCenter: true, amountMinor: true, currency: true } });
  const { t } = await getT();

  const byCenter = new Map<string, number>();
  for (const b of bills) {
    if (!b.costCenter) continue;
    byCenter.set(b.costCenter, (byCenter.get(b.costCenter) ?? 0) + b.amountMinor);
  }
  const rows = Array.from(byCenter.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.costCentersTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("dashboards.finance.costCenter")}</TH>
                <TH>{t("nav.spendings")}</TH>
              </TRow>
            </THead>
            <TBody>
              {rows.map(([name, amount]) => (
                <TRow key={name}>
                  <TD className="font-medium text-ink">{name}</TD>
                  <TD className="text-ink-muted">{formatCurrency(amount)}</TD>
                </TRow>
              ))}
              {rows.length === 0 && (
                <TRow>
                  <TD colSpan={2} className="py-8 text-center text-ink-faint">
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
