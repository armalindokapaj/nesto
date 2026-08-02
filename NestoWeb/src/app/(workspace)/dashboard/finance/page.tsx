import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, TrendingDown, Layers, Wallet, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getFinanceDashboardData } from "@/server/finance";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { TrendLineChart } from "@/components/ui/charts/line-chart";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function FinanceDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const data = await getFinanceDashboardData(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("dashboards.finance.greeting")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("dashboards.finance.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.finance.totalRevenue")} value={formatCurrency(data.revenue)} icon={TrendingUp} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/finance/invoices" />
        <StatTile label={t("dashboards.finance.totalExpenses")} value={formatCurrency(data.expenses)} icon={TrendingDown} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/finance/bills" />
        <StatTile label={t("dashboards.finance.netProfit")} value={formatCurrency(data.netProfit)} icon={Layers} iconColor="#4a3aa7" iconBg="#EEEAFB" />
        <StatTile label={t("dashboards.finance.cashBalance")} value={formatCurrency(data.cashBalance)} icon={Wallet} iconColor="#B76E00" iconBg="#FBECD2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
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
          <CardHeader>
            <CardTitle>{t("dashboards.finance.revenueByProject")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByProject.length > 0 ? (
              <DonutChart
                data={data.revenueByProject}
                centerLabel={t("dashboards.finance.total")}
                centerValue={formatCurrency(data.revenueByProject.reduce((s, p) => s + p.value, 0))}
                format="currency"
              />
            ) : (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.finance.noRevenue")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboards.finance.recentTransactions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.date")}</TH>
                  <TH>{t("common.description")}</TH>
                  <TH>{t("common.project")}</TH>
                  <TH>{t("common.amount")}</TH>
                  <TH>{t("common.status")}</TH>
                </TRow>
              </THead>
              <TBody>
                {data.recentTransactions.map((tx) => (
                  <TRow key={tx.id}>
                    <TD className="text-ink-muted whitespace-nowrap">{formatDate(tx.issuedDate)}</TD>
                    <TD>
                      <p className="font-medium text-ink">{tx.number}</p>
                      <p className="text-xs text-ink-muted">{tx.description}</p>
                    </TD>
                    <TD className="text-ink-muted">
                      {tx.project ? (
                        <Link href={`/projects/${tx.project.id}`} className="hover:text-gold hover:underline">
                          {tx.project.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className={tx.type === "INVOICE" ? "text-success font-medium" : "text-danger font-medium"}>
                      {tx.type === "INVOICE" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                    </TD>
                    <TD>
                      <Badge status={tx.status}>{tx.status}</Badge>
                    </TD>
                  </TRow>
                ))}
                {data.recentTransactions.length === 0 && (
                  <TRow>
                    <TD colSpan={5} className="text-center text-ink-faint py-8">
                      {t("dashboards.finance.noTransactions")}
                    </TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.finance.upcomingPayments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingPayments.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.finance.nothingDue")}</p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken shrink-0">
                        <FileText size={14} className="text-ink-muted" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{p.description ?? p.number}</p>
                        <p className="text-xs text-ink-muted">{p.dueDate ? formatDate(p.dueDate) : "—"}</p>
                      </div>
                    </div>
                    <span className="font-medium text-ink shrink-0">{formatCurrency(Math.abs(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
