import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo, getSingleProjectFinanceOverview } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProjectForecastTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const data = await getSingleProjectFinanceOverview(tenantId, id);
  const { t } = await getT();
  const variance = data.portfolioRow.forecast - data.portfolioRow.budget;

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="forecast" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabForecast")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-ink-muted">{t("dashboards.finance.budget")}</p>
            <p className="text-lg font-semibold text-ink">{formatCurrency(data.portfolioRow.budget)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("dashboards.finance.actual")}</p>
            <p className="text-lg font-semibold text-ink">{formatCurrency(data.portfolioRow.actual)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("dashboards.finance.forecast")}</p>
            <p className="text-lg font-semibold text-ink">{formatCurrency(data.portfolioRow.forecast)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("dashboards.finance.forecastVariance")}</p>
            <p className={`text-lg font-semibold ${variance <= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(variance)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("dashboards.finance.costToComplete")}</p>
            <p className="text-lg font-semibold text-ink">{formatCurrency(data.portfolioRow.costToComplete)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
