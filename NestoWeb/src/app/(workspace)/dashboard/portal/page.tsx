import { redirect } from "next/navigation";
import { FolderKanban, ShieldAlert, CircleCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getPortalDashboardData } from "@/server/portal-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { isExternalRole, DASHBOARD_BY_ROLE } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

// Phase 8 — an external client's entire console. Mirrors the CONTRACTOR
// dashboard's shape (PRD_4 §14): one scoped list, no tenant-wide aggregate,
// nothing reachable that the portal grant layer has not explicitly allowed.
export default async function PortalDashboardPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!isExternalRole(role)) redirect(DASHBOARD_BY_ROLE[role]);

  const data = await getPortalDashboardData(tenantId, user.id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole={role as Role} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label={t("dashboards.portal.activeProjects")} value={String(data.activeCount)} icon={FolderKanban} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("dashboards.portal.needsAttention")} value={String(data.attentionCount)} icon={ShieldAlert} iconColor="#C22B3A" iconBg="#FBE4E6" />
        <StatTile label={t("dashboards.portal.completed")} value={String(data.completedCount)} icon={CircleCheck} iconColor="#1A7F4E" iconBg="#E2F4EA" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.portal.yourProjects")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-muted">{t("dashboards.portal.noAccessTitle")}</p>
              <p className="mt-1 text-xs text-ink-faint">{t("dashboards.portal.noAccessHelper")}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {data.projects.map((p) => (
                <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* Deliberately not a link to /projects/[id]. The Projects
                          module is company-wide and unscoped (and frozen), so
                          there is no per-client project view to send them to
                          yet — status and progress are what this console can
                          show honestly. */}
                      <span className="font-medium text-ink truncate">{p.name}</span>
                      <Badge status={p.status}>{t(`projectStatus.${p.status}`)}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{p.code}</p>
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
