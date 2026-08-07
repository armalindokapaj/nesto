import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function BankingPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const accounts = await db.financeAccount.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.bankingTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.type")}</TH>
                <TH>{t("dashboards.finance.cashPosition")}</TH>
              </TRow>
            </THead>
            <TBody>
              {accounts.map((a) => (
                <TRow key={a.id}>
                  <TD className="font-medium text-ink">{a.name}</TD>
                  <TD className="text-ink-muted">{a.type}</TD>
                  <TD className="text-ink-muted">{formatCurrency(a.balance, a.currency)}</TD>
                </TRow>
              ))}
              {accounts.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-8 text-center text-ink-faint">
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
