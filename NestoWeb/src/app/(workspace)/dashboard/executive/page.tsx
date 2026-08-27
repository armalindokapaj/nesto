import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, TrendingUp, ClipboardCheck, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getExecutiveDashboardData } from "@/server/executive";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TrendLineChart } from "@/components/ui/charts/line-chart";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { can, isExternalRole, DASHBOARD_BY_ROLE } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ExecutiveDashboardPage() {
  const { tenantId, role } = await getCurrentUser();

  // Phase 8 — this console reports tenant-wide figures (active/at-risk counts
  // across every project, subsidiary count, and the five most recent projects
  // with the client name on each), so an external login must never reach it.
  //
  // The gate belongs here rather than at the 244 call sites that
  // `redirect("/dashboard/executive")` on a failed permission check: those
  // made this page the app's universal denied-access fallback, so a CLIENT or
  // CONTRACTOR bounced off any restricted page landed on the full portfolio.
  // Catching it at the destination closes all of them at once, and keeps the
  // frozen Projects pages untouched.
  if (isExternalRole(role)) redirect(DASHBOARD_BY_ROLE[role]);

  const canViewFinance = can(role, "FINANCE", "READ");
  const data = await getExecutiveDashboardData(tenantId, canViewFinance);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole={role as Role} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.executive.activeProjects")} value={String(data.activeProjectCount)} icon={FolderKanban} iconColor="#2457C5" iconBg="#E4ECFB" href="/projects" />
        <StatTile
          label={t("dashboards.executive.revenue")}
          value={data.revenue != null ? formatCurrency(data.revenue) : t("projects.restricted")}
          icon={TrendingUp}
          iconColor="#1A7F4E"
          iconBg="#E2F4EA"
        />
        <StatTile label={t("dashboards.executive.pendingApprovals")} value={String(data.pendingApprovals)} icon={ClipboardCheck} iconColor="#B76E00" iconBg="#FBECD2" href="/inbox" />
        <StatTile label={t("dashboards.executive.openRisks")} value={String(data.risks)} icon={ShieldAlert} iconColor="#C22B3A" iconBg="#FBE4E6" href="/projects?status=AT_RISK" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.cashFlowSeries && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboards.executive.financialOverview")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.cashFlowSeries.some((m) => m.actual > 0 || m.budget > 0) ? (
                <TrendLineChart
                  data={data.cashFlowSeries}
                  series={[
                    { key: "actual", label: t("dashboards.finance.totalRevenue") },
                    { key: "budget", label: t("dashboards.finance.totalExpenses") },
                  ]}
                  format="currency"
                />
              ) : (
                <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.executive.noFinancialData")}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.executive.subsidiaries")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-ink">{data.subsidiaryCount}</p>
            <p className="text-xs text-ink-muted mt-1">{t("dashboards.executive.subsidiariesHelper")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.executive.projectOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.executive.noProjects")}</p>
          ) : (
            <ul className="space-y-4">
              {data.projects.map((p) => (
                <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${p.id}`} className="font-medium text-ink truncate hover:text-gold hover:underline">
                        {p.name}
                      </Link>
                      <Badge status={p.status}>{t(`projectStatus.${p.status}`)}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{p.clientName ?? t("projects.internalProject")} · {p.code}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:w-48 shrink-0">
                    <ProgressBar value={p.progressPct} tone={p.status === "DELAYED" ? "danger" : p.status === "AT_RISK" ? "warning" : "gold"} />
                    <span className="text-xs font-medium text-ink-muted w-9 text-right">{p.progressPct}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
