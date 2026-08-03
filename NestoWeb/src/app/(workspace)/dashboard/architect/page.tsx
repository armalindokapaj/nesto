import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban, FileText, HelpCircle, ClipboardCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getArchitectDashboardData } from "@/server/architecture";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import type { Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ArchitectDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const data = await getArchitectDashboardData(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole={role as Role} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.architect.activeProjects")} value={String(data.activeProjects)} icon={FolderKanban} iconColor="#2457C5" iconBg="#E4ECFB" href="/projects" />
        <StatTile label={t("dashboards.architect.pendingDrawings")} value={String(data.pendingDrawings)} icon={FileText} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/architect/drawings?status=pending" />
        <StatTile label={t("dashboards.architect.openRfis")} value={String(data.openRfisCount)} icon={HelpCircle} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/architect/rfis?status=open" />
        <StatTile label={t("dashboards.architect.revisionsAwaiting")} value={String(data.revisionsAwaiting)} icon={ClipboardCheck} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/architect/approvals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("dashboards.architect.drawingPackages")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.project")}</TH>
                  <TH>{t("nav.drawings")}</TH>
                  <TH>{t("dashboards.architect.revision")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("dashboards.architect.updated")}</TH>
                </TRow>
              </THead>
              <TBody>
                {data.drawingPackages.map((d) => (
                  <TRow key={d.id}>
                    <TD className="font-medium text-ink">
                      <Link href={`/projects/${d.project.id}`} className="hover:text-gold hover:underline">
                        {d.project.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{d.packageName}</TD>
                    <TD className="text-ink-muted">{d.revisionCode}</TD>
                    <TD>
                      <Badge status={d.status}>{d.status.replace("_", " ")}</Badge>
                    </TD>
                    <TD className="text-ink-muted whitespace-nowrap">{formatDate(d.updatedAt)}</TD>
                  </TRow>
                ))}
                {data.drawingPackages.length === 0 && (
                  <TRow>
                    <TD colSpan={5} className="text-center text-ink-faint py-8">
                      {t("dashboards.architect.noPackages")}
                    </TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.architect.designPackageOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length > 0 ? (
              <DonutChart data={data.statusBreakdown} centerLabel={t("dashboards.architect.packages")} centerValue={String(data.totalPackages)} />
            ) : (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.architect.noPackagesShort")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.architect.recentRfis")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentRfis.length === 0 ? (
            <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.architect.noRfis")}</p>
          ) : (
            <ul className="space-y-3">
              {data.recentRfis.map((rfi) => (
                <li key={rfi.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{rfi.code} · {rfi.title}</p>
                    <p className="text-xs text-ink-muted">
                      <Link href={`/projects/${rfi.project.id}`} className="hover:text-gold hover:underline">
                        {rfi.project.name}
                      </Link>
                    </p>
                  </div>
                  <Badge status={rfi.status}>{rfi.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
