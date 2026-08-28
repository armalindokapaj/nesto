import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getBudgetVsActualByProject } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency } from "@/lib/utils";
import { formatMinorWhole } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export default async function BudgetVsActualPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const rows = await getBudgetVsActualByProject(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.budgetTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("finance_sub.budgetSubtitle")}</p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const net = row.actualRevenueMinor - row.actualExpensesMinor;
          const pctUsed = row.budgetMinor > 0 ? Math.round((row.actualExpensesMinor / row.budgetMinor) * 100) : 0;
          return (
            <Card key={row.id}>
              <CardHeader>
                <div>
                  <CardTitle>{row.name}</CardTitle>
                  <CardDescription>
                    {formatMinorWhole(row.actualExpensesMinor)} / {formatMinorWhole(row.budgetMinor)} {t("projects.budget").toLowerCase()}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ProgressBar value={Math.min(pctUsed, 100)} tone={pctUsed > 90 ? "danger" : pctUsed > 70 ? "warning" : "gold"} />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-ink-muted">{t("dashboards.finance.totalRevenue")}</p>
                    <p className="font-medium text-success mt-0.5">{formatMinorWhole(row.actualRevenueMinor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">{t("dashboards.finance.totalExpenses")}</p>
                    <p className="font-medium text-danger mt-0.5">{formatMinorWhole(row.actualExpensesMinor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">{t("dashboards.finance.netProfit")}</p>
                    <p className={`font-medium mt-0.5 ${net >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(net)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-ink-faint">{t("common.noResults")}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
