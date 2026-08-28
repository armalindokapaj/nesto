import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart3,
  Receipt,
  AlertOctagon,
  CalendarClock,
  PieChart,
  Percent,
} from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCompanyFinanceOverview } from "@/server/finance-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { FinanceScopeBar } from "@/components/dashboards/finance-scope-bar";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor, formatMinorWhole } from "@/lib/money";

// PRD_Finance_Dashboard §6 — Company Overview, the default Finance scope
// mode. §5 "Company Overview / All Projects / Single Project" are separate
// routes (this one, /dashboard/finance/projects, /dashboard/finance/projects/[id])
// rather than client-side tab state — a deep link into any of them still
// resolves inside the Finance shell (§16).
export default async function FinanceDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const data = await getCompanyFinanceOverview(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="FINANCE" />
      <FinanceScopeBar mode="company" />

      {/* §6.1 — exactly twelve company KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.finance.cashPosition")} value={formatMinorWhole(data.kpis.cashPositionMinor)} icon={Wallet} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/finance/banking" />
        <StatTile label={t("dashboards.finance.totalRevenue")} value={formatMinorWhole(data.kpis.revenueMinor)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/finance/revenue" />
        <StatTile label={t("dashboards.finance.totalExpenses")} value={formatMinorWhole(data.kpis.expensesMinor)} icon={TrendingDown} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/finance/expenses" />
        <StatTile label={t("dashboards.finance.grossProfit")} value={formatMinorWhole(data.kpis.grossProfitMinor)} icon={Layers} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/finance/statements" />
        <StatTile label={t("dashboards.finance.netProfit")} value={formatMinorWhole(data.kpis.netProfitMinor)} icon={Layers} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/finance/statements" />
        <StatTile label={t("dashboards.finance.ebitda")} value={formatMinorWhole(data.kpis.ebitdaMinor)} icon={BarChart3} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/finance/statements" />
        <StatTile label={t("dashboards.finance.receivables")} value={formatMinorWhole(data.kpis.receivablesMinor)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/finance/receivables" />
        <StatTile label={t("dashboards.finance.payables")} value={formatMinorWhole(data.kpis.payablesMinor)} icon={TrendingDown} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/finance/payables" />
        <StatTile
          label={t("dashboards.finance.overdueInvoices")}
          value={String(data.kpis.overdueInvoices.count)}
          helper={formatMinor(data.kpis.overdueInvoices.amountMinor)}
          icon={AlertOctagon}
          iconColor="#c0392b"
          iconBg="#FBE4E1"
          href="/dashboard/finance/receivables"
        />
        <StatTile label={t("dashboards.finance.upcomingPayments")} value={String(data.kpis.upcomingPayments.length)} icon={CalendarClock} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/finance/payables" />
        <StatTile
          label={t("dashboards.finance.budgetUsage")}
          value={data.kpis.budgetUsagePct === null ? "—" : `${data.kpis.budgetUsagePct}%`}
          icon={PieChart}
          iconColor="#4a3aa7"
          iconBg="#EEEAFB"
          href="/dashboard/finance/budgets"
        />
        <StatTile label={t("dashboards.finance.forecastVariance")} value={formatMinorWhole(data.kpis.forecastVarianceMinor)} icon={TrendingUp} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/finance/forecast" />
        <StatTile label={t("dashboards.finance.taxLiabilities")} value={formatMinorWhole(data.kpis.taxLiabilitiesMinor)} icon={Percent} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/finance/tax" />
      </div>

      {/* §6.2 Spending Control */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.spendingControl")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <Link href="/dashboard/finance/spendings?status=PENDING" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
              <p className="text-lg font-semibold text-ink">{data.spendingControl.pendingApprovalCount}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t("dashboards.finance.pendingApproval")}</p>
              <p className="text-xs text-ink-faint">{formatMinorWhole(data.spendingControl.pendingApprovalAmountMinor)}</p>
            </Link>
            <Link href="/dashboard/finance/spendings?status=APPROVED_FOR_PAYMENT" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
              <p className="text-lg font-semibold text-ink">{data.spendingControl.approvedForPaymentCount}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t("dashboards.finance.approvedForPayment")}</p>
              <p className="text-xs text-ink-faint">{formatMinorWhole(data.spendingControl.approvedForPaymentAmountMinor)}</p>
            </Link>
            <Link href="/dashboard/finance/spendings?status=PAID" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
              <p className="text-lg font-semibold text-ink">{data.spendingControl.paidCount}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t("dashboards.finance.paidThisPeriod")}</p>
              <p className="text-xs text-ink-faint">{formatMinorWhole(data.spendingControl.paidAmountMinor)}</p>
            </Link>
            <Link href="/dashboard/finance/spendings?overBudget=true" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
              <p className="text-lg font-semibold text-ink">{data.spendingControl.overBudgetCount}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t("dashboards.finance.overBudget")}</p>
            </Link>
            <Link href="/dashboard/finance/spendings?status=DRAFT" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
              <Receipt size={16} className="mx-auto text-ink-muted" />
              <p className="text-xs text-ink-muted mt-0.5">{t("dashboards.finance.drafts")}</p>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* §7 Project Financial Portfolio — permanent section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.projectPortfolio")}</CardTitle>
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
                <TH>{t("dashboards.finance.forecast")}</TH>
              </TRow>
            </THead>
            <TBody>
              {data.projectPortfolio.map((p) => (
                <TRow key={p.project.id}>
                  <TD className="font-medium text-ink whitespace-nowrap">
                    <Link href={`/dashboard/finance/projects/${p.project.id}`} className="hover:text-gold hover:underline">
                      {p.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.budgetMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.committedMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.actualMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.spendingsMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.revenueMinor)}</TD>
                  <TD className={p.profitMinor >= 0 ? "text-success font-medium" : "text-danger font-medium"}>{formatMinorWhole(p.profitMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinorWhole(p.forecastMinor)}</TD>
                </TRow>
              ))}
              {data.projectPortfolio.length === 0 && (
                <TRow>
                  <TD colSpan={8} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noProjectsAccessible")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent financial activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.admin.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.finance.noActivity")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-ink truncate">{a.summary}</span>
                  <span className="text-xs text-ink-muted shrink-0">
                    {a.actor?.displayName ?? "—"} · {formatDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
