import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCompanyFinanceOverview } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §4 "Financial Statements" — a compact P&L view built from the same KPI
// formulas as Company Overview (§15 "reconcile under the same scope/period/
// currency"), not a second calculation.
export default async function FinancialStatementsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { kpis } = await getCompanyFinanceOverview(tenantId);
  const { t } = await getT();

  const rows = [
    [t("dashboards.finance.totalRevenue"), kpis.revenueMinor],
    [t("dashboards.finance.totalExpenses"), -kpis.expensesMinor],
    [t("dashboards.finance.grossProfit"), kpis.grossProfitMinor],
    [t("dashboards.finance.netProfit"), kpis.netProfitMinor],
    [t("dashboards.finance.ebitda"), kpis.ebitdaMinor],
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.statementsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <li key={label} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-muted">{label}</span>
                <span className={value >= 0 ? "font-medium text-ink" : "font-medium text-danger"}>{formatCurrency(value)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
