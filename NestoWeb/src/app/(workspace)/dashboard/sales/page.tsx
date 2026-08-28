import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserPlus,
  BadgeCheck,
  Target,
  TrendingUp,
  CalendarRange,
  ScrollText,
  Building2,
  Wallet,
  Receipt,
  Percent,
} from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCrmOverview } from "@/server/crm-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { SalesQuickActions } from "@/components/dashboards/sales-quick-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatMinorWhole } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard v1.0 — the Sales role's locked home workspace.
// §7 "Dashboard Information Architecture" fixes the section order below;
// §33 "Explicitly Not Allowed" forbids adding sections/KPIs beyond this.
export default async function SalesDashboardPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");

  const data = await getCrmOverview(tenantId, { userId: user.id, role });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <DashboardGreeting greetingRole="SALES" />
        <SalesQuickActions />
      </div>

      {/* §8 — exactly twelve KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.sales.totalClients")} value={String(data.kpis.totalClients)} icon={Users} iconColor="#2457C5" iconBg="#E4ECFB" href="/clients" />
        <StatTile label={t("dashboards.sales.activeClients")} value={String(data.kpis.activeClients)} icon={UserCheck} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/clients?status=ACTIVE" />
        <StatTile label={t("dashboards.sales.newLeads")} value={String(data.kpis.newLeads)} icon={UserPlus} iconColor="#B76E00" iconBg="#FBECD2" href="/clients/leads" />
        <StatTile label={t("dashboards.sales.qualifiedLeads")} value={String(data.kpis.qualifiedLeads)} icon={BadgeCheck} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/clients/leads?status=QUALIFIED" />
        <StatTile label={t("dashboards.sales.openOpportunities")} value={String(data.kpis.openOpportunities)} icon={Target} iconColor="#2457C5" iconBg="#E4ECFB" href="/clients/opportunities" />
        <StatTile label={t("dashboards.sales.pipelineValue")} value={formatMinorWhole(data.kpis.pipelineValueMinor)} icon={TrendingUp} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/clients/pipeline" />
        <StatTile label={t("dashboards.sales.reservations")} value={String(data.kpis.reservations)} icon={CalendarRange} iconColor="#B76E00" iconBg="#FBECD2" href="/clients/reservations" />
        <StatTile label={t("dashboards.sales.contracts")} value={String(data.kpis.contracts)} icon={ScrollText} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/contracts" />
        <StatTile label={t("dashboards.sales.unitsSold")} value={String(data.kpis.unitsSold)} icon={Building2} iconColor="#2457C5" iconBg="#E4ECFB" href="/units" />
        <StatTile
          label={t("dashboards.sales.revenue")}
          value={data.kpis.revenueMinor === null ? t("dashboards.sales.restricted") : formatMinorWhole(data.kpis.revenueMinor)}
          icon={Wallet}
          iconColor="#1A7F4E"
          iconBg="#E2F4EA"
          href={data.kpis.revenueMinor === null ? undefined : "/reports"}
        />
        <StatTile
          label={t("dashboards.sales.outstandingPayments")}
          value={data.kpis.outstandingPaymentsMinor === null ? t("dashboards.sales.restricted") : formatMinorWhole(data.kpis.outstandingPaymentsMinor)}
          icon={Receipt}
          iconColor="#B76E00"
          iconBg="#FBECD2"
          href={data.kpis.outstandingPaymentsMinor === null ? undefined : "/clients/payments"}
        />
        <StatTile label={t("dashboards.sales.conversionRate")} value={`${data.kpis.conversionRate}%`} icon={Percent} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/reports" />
      </div>

      {/* §9 Sales Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.sales.pipelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.pipeline.stages.length === 0 ? (
            <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.sales.noPipeline")}</p>
          ) : (
            <div className="flex gap-3 min-w-max">
              {data.pipeline.stages.map((s) => (
                <Link
                  key={s.id}
                  href={`/clients/pipeline?stage=${s.id}`}
                  className="w-44 shrink-0 rounded-xl border border-border p-3 hover:border-gold/60 transition-colors"
                >
                  <p className="text-xs font-medium text-ink-muted truncate">{s.name}</p>
                  <p className="text-lg font-semibold text-ink mt-1">{s.count}</p>
                  <p className="text-xs text-ink-faint mt-0.5">{formatCurrency(s.value)}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* §10 Leads */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.leadsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.leads.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.sales.noLeads")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.leads.map((l) => (
                  <li key={l.id}>
                    <Link href="/clients/leads" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{l.title}</p>
                        <p className="text-xs text-ink-muted">{l.source ?? "—"}</p>
                      </div>
                      <Badge status={l.status}>{l.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* §11 Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.opportunitiesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.opportunities.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.sales.noOpportunities")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href="/clients/opportunities" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{o.title}</p>
                        <p className="text-xs text-ink-muted">{o.client.name} · {o.stage.name}</p>
                      </div>
                      <span className="text-sm font-medium text-ink shrink-0">{o.estimatedValue ? formatCurrency(o.estimatedValue) : "—"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* §12 Reservations */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.reservationsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.reservations.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.sales.noReservations")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.reservations.map((r) => (
                  <li key={r.id}>
                    <Link href="/clients/reservations" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{r.client.name} — {r.unit.code}</p>
                        <p className="text-xs text-ink-muted">{r.unit.project?.name ?? "—"}</p>
                      </div>
                      <Badge status={r.reservationStatus ?? "ACTIVE"}>{r.reservationStatus ?? "ACTIVE"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* §13 Sales & Units */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.salesUnitsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              {(
                [
                  ["interested", data.sales_units.counts.interested],
                  ["viewed", data.sales_units.counts.viewed],
                  ["reserved", data.sales_units.counts.reserved],
                  ["purchased", data.sales_units.counts.purchased],
                  ["rented", data.sales_units.counts.rented],
                  ["released", data.sales_units.counts.released],
                ] as const
              ).map(([key, value]) => (
                <Link key={key} href="/clients/reservations" className="rounded-lg border border-border p-3 hover:border-gold/60 transition-colors">
                  <p className="text-lg font-semibold text-ink">{value}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{t(`dashboards.sales.units.${key}`)}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* §14 Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.sales.financialSummaryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.financial_summary ? (
            <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.sales.financeRestricted")}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-ink-muted">{t("dashboards.sales.contractValue")}</p>
                <p className="text-lg font-semibold text-ink">{formatMinorWhole(data.financial_summary.contractValueMinor)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t("dashboards.sales.amountPaid")}</p>
                <p className="text-lg font-semibold text-ink">{formatMinorWhole(data.financial_summary.amountPaidMinor)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t("dashboards.sales.remainingBalance")}</p>
                <p className="text-lg font-semibold text-ink">{formatMinorWhole(data.financial_summary.remainingBalanceMinor)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t("dashboards.sales.nextPaymentDue")}</p>
                <p className="text-lg font-semibold text-ink">
                  {data.financial_summary.nextPaymentDue ? formatDate(data.financial_summary.nextPaymentDue) : "—"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* §15 Work */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.workTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-2">{t("dashboards.sales.upcomingMeetings")}</p>
              {data.work.upcomingMeetings.length === 0 ? (
                <p className="text-sm text-ink-faint py-2">{t("dashboards.sales.noMeetings")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.work.upcomingMeetings.map((m) => (
                    <li key={m.id}>
                      <Link href="/meetings" className="flex items-center justify-between text-sm hover:text-gold">
                        <span className="truncate">{m.title}</span>
                        <span className="text-xs text-ink-muted shrink-0">{formatDate(m.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-2">{t("dashboards.sales.openTasks")}</p>
              {data.work.openTasks.length === 0 ? (
                <p className="text-sm text-ink-faint py-2">{t("dashboards.sales.noTasks")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.work.openTasks.map((task) => (
                    <li key={task.id}>
                      <Link href="/tasks" className="flex items-center justify-between text-sm hover:text-gold">
                        <span className="truncate">{task.title}</span>
                        <Badge status={task.status}>{task.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* §16 Performance */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.sales.performanceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-2">{t("dashboards.sales.byOwner")}</p>
              {data.performance.byOwner.length === 0 ? (
                <p className="text-sm text-ink-faint py-2">{t("dashboards.sales.noData")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.performance.byOwner.map((o) => (
                    <li key={o.ownerId ?? "unassigned"} className="flex items-center justify-between text-sm">
                      <span>{o.ownerName}</span>
                      <span className="text-ink-muted">{o.count} · {formatMinorWhole(o.valueMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-2">{t("dashboards.sales.leadSources")}</p>
              {data.performance.leadSources.length === 0 ? (
                <p className="text-sm text-ink-faint py-2">{t("dashboards.sales.noData")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.performance.leadSources.map((s) => (
                    <li key={s.source} className="flex items-center justify-between text-sm">
                      <span>{s.source}</span>
                      <span className="text-ink-muted">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* §17 Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.sales.recentActivityTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.sales.noActivity")}</p>
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.date")}</TH>
                  <TH>{t("common.description")}</TH>
                  <TH>{t("crm.owner")}</TH>
                  <TH>{t("nav.clients")}</TH>
                </TRow>
              </THead>
              <TBody>
                {data.recent_activity.map((e) => (
                  <TRow key={e.id}>
                    <TD className="text-ink-muted whitespace-nowrap">{formatDate(e.time)}</TD>
                    <TD>{e.summary}</TD>
                    <TD className="text-ink-muted">{e.actor}</TD>
                    <TD className="text-ink-muted">
                      {e.clientId ? (
                        <Link href={`/clients/${e.clientId}`} className="hover:text-gold hover:underline">
                          {e.context}
                        </Link>
                      ) : (
                        e.context
                      )}
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
