import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getAnalyticsOverview, ensureMetricCatalogue, listActiveProjectForecasts, listCurrencyRates } from "@/server/analytics";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CreateCurrencyRateDialog } from "@/components/analytics/currency-rate-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Reporting_Analytics Phase 1 — Executive Overview. Live queries only
// (2026-08-06 scope decision, no CDC warehouse); every section is gated by
// the same permission the owning module's own dashboard already checks —
// "permission before aggregation" (server/executive.ts's Audit C1 pattern).
export default async function AnalyticsOverviewPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("analytics.page.overview")) redirect("/dashboard/executive");

  const access = {
    finance: can(role, "FINANCE", "READ"),
    hr: can(role, "HR", "READ"),
    procurement: can(role, "PROCUREMENT", "READ"),
    workProgress: can(role, "PROJECTS", "READ"),
    hse: can(role, "HSE_REPORTS", "READ"),
  };

  const canManageRates = can(role, "FINANCE", "WRITE");
  const [overview, metrics, forecasts, currencyRates] = await Promise.all([
    getAnalyticsOverview(tenantId, access),
    ensureMetricCatalogue(tenantId),
    listActiveProjectForecasts(tenantId),
    listCurrencyRates(tenantId),
  ]);
  const { t } = await getT();

  const tiles = [
    { label: t("analytics.activeProjects"), value: overview.projects.activeCount, tone: "text-ink" },
    { label: t("analytics.atRiskProjects"), value: overview.projects.atRiskCount, tone: "text-danger" },
    ...(overview.finance ? [{ label: t("analytics.budgetVariance"), value: formatCurrency(overview.finance.totalActual - overview.finance.totalBudget), tone: overview.finance.totalActual >= overview.finance.totalBudget ? "text-success" : "text-warning" }] : []),
    ...(overview.hr ? [{ label: t("analytics.headcount"), value: overview.hr.headcount, tone: "text-ink" }] : []),
    ...(overview.procurement ? [{ label: t("analytics.committedSpend"), value: formatCurrency(overview.procurement.committedSpend), tone: "text-ink" }] : []),
    ...(overview.workProgress ? [{ label: t("analytics.acceptedProgress"), value: `${overview.workProgress.acceptedPct.toFixed(1)}%`, tone: "text-ink" }] : []),
    ...(overview.hse ? [{ label: t("analytics.openIncidents"), value: overview.hse.openIncidents, tone: overview.hse.openIncidents > 0 ? "text-danger" : "text-success" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("analytics.title")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("analytics.subtitle")}</p>
        </div>
        <Link href="/analytics/reports" className="text-sm text-gold hover:underline">{t("analytics.reportLibrary")} →</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="py-4">
              <p className="text-xs text-ink-faint">{tile.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${tile.tone}`}>{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {forecasts.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-sm">{t("analytics.completionForecast")}</CardTitle>
              <CardDescription>{t("analytics.forecastLinearNote")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {forecasts.map(({ project, forecast }) => (
              <div key={project.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{project.code} — {project.name}</span>
                <span className="text-ink">{forecast.forecastDate ? formatDate(forecast.forecastDate) : "—"} ({forecast.progressPct}%)</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">{t("analytics.currencyRates")}</CardTitle>
              <CardDescription>{t("analytics.currencyRatesSubtitle")}</CardDescription>
            </div>
            {canManageRates && <CreateCurrencyRateDialog />}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {currencyRates.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{r.fromCurrency} → {r.toCurrency}</span>
              <span className="text-ink">{r.rate} <span className="text-ink-faint text-xs">({formatDate(r.asOf)})</span></span>
            </div>
          ))}
          {currencyRates.length === 0 && <p className="text-sm text-ink-faint">{t("analytics.noRates")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("analytics.kpiCatalogue")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{m.label}</p>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.65rem] text-ink-faint">{m.category}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{m.description}</p>
                <p className="mt-2 font-mono text-[0.68rem] text-ink-faint">{m.formulaSummary}</p>
                <p className="mt-1 text-[0.65rem] text-ink-faint">{t("analytics.source")}: {m.sourceModule}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
