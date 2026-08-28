import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getAllProjectsFinanceOverview } from "@/server/finance-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { FinanceScopeBar } from "@/components/dashboards/finance-scope-bar";

import { formatMinor } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { Wallet, TrendingUp, TrendingDown, Layers, PieChart } from "lucide-react";

// PRD_Finance_Dashboard §8 — All Projects view. §8.2 "uses the same Project
// Financial Portfolio columns defined in §7 ... no separate project-finance
// data model is permitted" — reuses getProjectFinancialPortfolio via
// getAllProjectsFinanceOverview, same source as Company Overview §7.
export default async function AllProjectsFinancePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const { totals, portfolio } = await getAllProjectsFinanceOverview(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="FINANCE" />
      <FinanceScopeBar mode="all-projects" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.finance.totalBudgets")} value={formatMinor(totals.budgetMinor)} icon={PieChart} iconColor="#4a3aa7" iconBg="#EEEAFB" />
        <StatTile label={t("dashboards.finance.totalCommitted")} value={formatMinor(totals.committedMinor)} icon={Wallet} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label={t("dashboards.finance.totalActual")} value={formatMinor(totals.actualMinor)} icon={TrendingDown} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label={t("dashboards.finance.totalProjectRevenue")} value={formatMinor(totals.revenueMinor)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("dashboards.finance.totalProfit")} value={formatMinor(totals.profitMinor)} icon={Layers} iconColor="#4a3aa7" iconBg="#EEEAFB" />
        <StatTile label={t("dashboards.finance.totalReceivables")} value={formatMinor(totals.receivablesMinor)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("dashboards.finance.totalPayables")} value={formatMinor(totals.payablesMinor)} icon={TrendingDown} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label={t("dashboards.finance.totalForecast")} value={formatMinor(totals.forecastMinor)} icon={TrendingUp} iconColor="#1A7F4E" iconBg="#E2F4EA" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.allProjectsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <THead>
              <TRow>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("dashboards.finance.budget")}</TH>
                <TH>{t("dashboards.finance.committed")}</TH>
                <TH>{t("dashboards.finance.actual")}</TH>
                <TH>{t("nav.spendings")}</TH>
                <TH>{t("dashboards.finance.revenue")}</TH>
                <TH>{t("dashboards.finance.profit")}</TH>
                <TH>{t("dashboards.finance.receivables")}</TH>
                <TH>{t("dashboards.finance.payables")}</TH>
                <TH>{t("dashboards.finance.forecast")}</TH>
                <TH>{t("dashboards.finance.costToComplete")}</TH>
              </TRow>
            </THead>
            <TBody>
              {portfolio.map((p) => (
                <TRow key={p.project.id}>
                  <TD className="font-medium text-ink whitespace-nowrap">
                    <Link href={`/dashboard/finance/projects/${p.project.id}`} className="hover:text-gold hover:underline">
                      {p.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{formatMinor(p.budgetMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.committedMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.actualMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.spendingsMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.revenueMinor)}</TD>
                  <TD className={p.profitMinor >= 0 ? "text-success font-medium" : "text-danger font-medium"}>{formatMinor(p.profitMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.receivablesMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.payablesMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.forecastMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.costToCompleteMinor)}</TD>
                </TRow>
              ))}
              {portfolio.length === 0 && (
                <TRow>
                  <TD colSpan={11} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noProjectsAccessible")}
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
