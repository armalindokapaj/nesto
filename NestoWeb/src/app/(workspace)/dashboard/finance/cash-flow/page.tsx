import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getFinanceDashboardData } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { TrendLineChart } from "@/components/ui/charts/line-chart";

import { formatMinor } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export default async function CashFlowPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const data = await getFinanceDashboardData(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.cashFlowTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("finance_sub.cashFlowSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.cashFlowOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.cashFlowSeries.length > 0 ? (
            <TrendLineChart
              data={data.cashFlowSeries}
              series={[
                { key: "revenue", label: t("dashboards.finance.totalRevenue") },
                { key: "expenses", label: t("dashboards.finance.totalExpenses") },
              ]}
              format="currency"
            />
          ) : (
            <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.finance.noCashFlow")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("dashboards.finance.totalRevenue")}</TH>
                <TH>{t("dashboards.finance.totalExpenses")}</TH>
                <TH>{t("dashboards.finance.netProfit")}</TH>
              </TRow>
            </THead>
            <TBody>
              {data.cashFlowSeries.map((row) => (
                <TRow key={row.label}>
                  <TD className="font-medium text-ink">{row.label}</TD>
                  <TD className="text-success">{formatMinor(row.revenueMinor)}</TD>
                  <TD className="text-danger">{formatMinor(row.expensesMinor)}</TD>
                  <TD className={row.revenueMinor - row.expensesMinor >= 0 ? "text-success font-medium" : "text-danger font-medium"}>
                    {formatMinor(row.revenueMinor - row.expensesMinor)}
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
