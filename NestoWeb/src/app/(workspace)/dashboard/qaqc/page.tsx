import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, AlertOctagon, Bug, Clock, ShieldAlert, Home } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getQaqcDashboard } from "@/server/qaqc-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_QAQC_Dashboard §4/§5 — the exact six Primary Cues, Needs My Attention,
// Inspection Control, NCR & CAPA Status, Defects/Snags/Punch, Quality
// Gates, Handover Readiness (honest stub — see nav.handover pages), Upcoming
// and Recent Activity.
export default async function QaqcDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const data = await getQaqcDashboard(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="QAQC" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label={t("qaqcModule.inspectionsDue")} value={String(data.cues.inspectionsDue)} icon={ClipboardList} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/qaqc/inspections" />
        <StatTile label={t("qaqcModule.openNcrs")} value={String(data.cues.openNcrs)} icon={AlertOctagon} iconColor="#C0392B" iconBg="#FBE4E1" href="/dashboard/qaqc/ncrs" />
        <StatTile label={t("qaqcModule.openDefects")} value={String(data.cues.openDefects)} icon={Bug} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/qaqc/defects" />
        <StatTile label={t("qaqcModule.overdueCorrectiveActions")} value={String(data.cues.overdueCorrectiveActions)} icon={Clock} iconColor="#C0392B" iconBg="#FBE4E1" href="/dashboard/qaqc/corrective-actions" />
        <StatTile label={t("qaqcModule.blockingQualityGates")} value={String(data.cues.blockingQualityGates)} icon={ShieldAlert} iconColor="#4a3aa7" iconBg="#EEEAFB" />
        <StatTile label={t("qaqcModule.handoverBlockers")} value={String(data.cues.handoverBlockers)} icon={Home} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/qaqc/handover" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>{t("qaqcModule.inspectionControl")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <Metric label={t("qaqcModule.open")} value={data.inspectionControl.open} />
          <Metric label={t("qaqcModule.scheduled")} value={data.inspectionControl.scheduled} />
          <Metric label={t("qaqcModule.passed")} value={data.inspectionControl.passed} />
          <Metric label={t("qaqcModule.failed")} value={data.inspectionControl.failed} tone={data.inspectionControl.failed ? "danger" : "neutral"} />
          <Metric label={t("qaqcModule.reinspectionRequired")} value={data.inspectionControl.reinspectionRequired} tone={data.inspectionControl.reinspectionRequired ? "danger" : "neutral"} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>{t("qaqcModule.ncrCapaStatus")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <Metric label={t("qaqcModule.open")} value={data.ncrStatus.open} />
          <Metric label={t("qaqcModule.severity_CRITICAL")} value={data.ncrStatus.critical} tone={data.ncrStatus.critical ? "danger" : "neutral"} />
          <Metric label={t("qaqcModule.overdue")} value={data.ncrStatus.overdue} tone={data.ncrStatus.overdue ? "danger" : "neutral"} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>{t("qaqcModule.qualityIssues")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <Metric label={t("qaqcModule.open")} value={data.qualityIssues.open} />
          <Metric label={t("qaqcModule.severity_CRITICAL")} value={data.qualityIssues.critical} tone={data.qualityIssues.critical ? "danger" : "neutral"} />
          <Metric label={t("qaqcModule.readyForVerification")} value={data.qualityIssues.readyForVerification} />
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>{t("qaqcModule.qualityGates")}</CardTitle></CardHeader><CardContent className="space-y-2">
          {data.qualityGates.filter((g) => g.blocking).map((g) => (
            <div key={g.projectId} className="flex items-center justify-between text-sm">
              <span className="text-ink">{g.projectName}</span>
              <Badge tone="danger">{t("qaqcModule.blocking")}</Badge>
            </div>
          ))}
          {data.qualityGates.filter((g) => g.blocking).length === 0 && <p className="text-sm text-ink-faint">{t("qaqcModule.noBlockingGates")}</p>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>{t("qaqcModule.upcoming")}</CardTitle></CardHeader><CardContent className="space-y-2">
          {data.upcoming.map((i) => (
            <Link key={i.id} href={`/dashboard/qaqc/inspections`} className="flex items-center justify-between text-sm text-ink hover:text-gold">
              <span>{i.number}</span>
              <span className="text-ink-muted">{i.plannedDate && formatDate(i.plannedDate)}</span>
            </Link>
          ))}
          {data.upcoming.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>{t("dashboards.recentActivity")}</CardTitle></CardHeader><CardContent className="space-y-2">
          {data.recentActivity.map((a) => (
            <div key={a.id} className="text-sm">
              <span className="text-ink">{a.summary}</span>
              <span className="block text-xs text-ink-faint">{a.actor?.displayName ?? "—"} · {formatDate(a.createdAt)}</span>
            </div>
          ))}
          {data.recentActivity.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "danger" }) {
  return <div className="flex items-center justify-between"><span className="text-ink-muted">{label}</span><span className={tone === "danger" ? "font-semibold text-danger" : "font-semibold text-ink"}>{value}</span></div>;
}
