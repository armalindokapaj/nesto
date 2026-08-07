import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getSingleProjectFinanceOverview } from "@/server/finance-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { FinanceScopeBar } from "@/components/dashboards/finance-scope-bar";
import { ProjectFinanceTabs } from "@/components/dashboards/project-finance-tabs";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { Wallet, TrendingUp, TrendingDown, Layers, Receipt, ArrowRightLeft } from "lucide-react";

// PRD_Finance_Dashboard §9 — Single Project Finance Dashboard, Overview tab.
// §9.1 "Project Status ... read from Projects source record; Finance does
// not edit project lifecycle" — status/name read-only here, never written.
export default async function ProjectFinanceOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);

  const data = await getSingleProjectFinanceOverview(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="FINANCE" />
      <FinanceScopeBar mode="project" projectName={data.project.name} />

      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{data.project.name}</h2>
        <Badge status={data.project.status}>{data.project.status}</Badge>
      </div>
      <ProjectFinanceTabs projectId={id} active="" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.finance.approvedBudget")} value={formatCurrency(data.portfolioRow.budget)} icon={Wallet} iconColor="#4a3aa7" iconBg="#EEEAFB" href={`/dashboard/finance/projects/${id}/budget`} />
        <StatTile label={t("dashboards.finance.committedCost")} value={formatCurrency(data.portfolioRow.committed)} icon={Layers} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label={t("dashboards.finance.actualCost")} value={formatCurrency(data.portfolioRow.actual)} icon={TrendingDown} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label={t("nav.spendings")} value={formatCurrency(data.portfolioRow.spendings)} icon={Receipt} iconColor="#B76E00" iconBg="#FBECD2" href={`/dashboard/finance/projects/${id}/spendings`} />
        <StatTile label={t("dashboards.finance.revenue")} value={formatCurrency(data.portfolioRow.revenue)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" href={`/dashboard/finance/projects/${id}/revenue`} />
        <StatTile label={t("dashboards.finance.profit")} value={formatCurrency(data.portfolioRow.profit)} icon={Layers} iconColor="#4a3aa7" iconBg="#EEEAFB" />
        <StatTile label={t("dashboards.finance.receivables")} value={formatCurrency(data.portfolioRow.receivables)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("dashboards.finance.payables")} value={formatCurrency(data.portfolioRow.payables)} icon={TrendingDown} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label={t("dashboards.finance.cashFlow")} value={formatCurrency(data.cashFlow)} icon={ArrowRightLeft} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label={t("dashboards.finance.forecast")} value={formatCurrency(data.portfolioRow.forecast)} icon={TrendingUp} iconColor="#4a3aa7" iconBg="#EEEAFB" href={`/dashboard/finance/projects/${id}/forecast`} />
        <StatTile label={t("dashboards.finance.costToComplete")} value={formatCurrency(data.portfolioRow.costToComplete)} icon={Layers} iconColor="#B76E00" iconBg="#FBECD2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabOverview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-muted">{t("common.status")}</p>
            <p className="font-medium text-ink">{data.project.status}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("nav.spendings")}</p>
            <p className="font-medium text-ink">{data.spendingBillsCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
