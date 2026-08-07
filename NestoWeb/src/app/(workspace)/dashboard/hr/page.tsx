import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, UserPlus, ClipboardList, Timer } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getHrDashboard } from "@/server/hr-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_HR_Dashboard §5 — the 11-region layout: Employees, Workforce Today,
// Recruitment, Attendance, Timesheets, Leave & Absence, Payroll
// (independently permission-gated below), Training & Competence, Project
// Labour, Work Inbox, Recent Activity.
export default async function HrDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canSeePayroll = can(role, "HR", "WRITE") || can(role, "HR", "FULL");

  const data = await getHrDashboard(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="HR" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.hr.totalEmployees")} value={String(data.employees.total)} icon={Users} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/hr/employees" />
        <StatTile label={t("dashboards.hr.newHires")} value={String(data.employees.newHires)} icon={UserPlus} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/hr/onboarding" />
        <StatTile label={t("hrDashboard.presentToday")} value={String(data.workforceToday.presentNow)} icon={ClipboardList} iconColor="#B76E00" iconBg="#FBECD2" helper={`${data.workforceToday.onLeave} ${t("dashboards.hr.onLeave")}`} href="/dashboard/hr/attendance" />
        <StatTile label={t("nav.timesheets")} value={String(data.timesheets.pendingVerification)} icon={Timer} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/hr/timesheets" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("nav.recruitment")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-ink-muted">{t("nav.vacancies")}</span><Link href="/dashboard/hr/recruitment" className="font-semibold text-ink hover:text-gold">{data.recruitment.openVacancies}</Link></div>
            <div className="flex items-center justify-between"><span className="text-ink-muted">{t("nav.candidates")}</span><Link href="/dashboard/hr/candidates" className="font-semibold text-ink hover:text-gold">{data.recruitment.activeCandidates}</Link></div>
            <div className="flex items-center justify-between"><span className="text-ink-muted">{t("hrDashboard.offersOut")}</span><span className="font-semibold text-ink">{data.recruitment.pendingOffers}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.hr.onLeave")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.workforceToday.onLeaveList.map((l) => (
              <div key={l.id} className="text-sm text-ink">{l.employee.fullName}</div>
            ))}
            {data.workforceToday.onLeaveList.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
            <Link href="/dashboard/hr/leave" className="block pt-1 text-xs text-gold hover:underline">{data.leave.pendingCount} {t("dashboards.hr.pendingRequests")}</Link>
          </CardContent>
        </Card>

        {canSeePayroll ? (
          <Card>
            <CardHeader><CardTitle>{t("nav.payroll")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-ink-muted">{t("hrDashboard.runsInProgress")}</span><Link href="/dashboard/hr/payroll" className="font-semibold text-ink hover:text-gold">{data.payroll.runsInProgress}</Link></div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>{t("nav.training")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.training.expiringSoon.slice(0, 4).map((tr) => (
                <div key={tr.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{tr.employee.fullName}</span>
                  <span className="text-ink-muted">{tr.name}</span>
                </div>
              ))}
              {data.training.expiringSoon.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("hrDashboard.hoursByProject")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.projectLabour.byProject.slice(0, 5).map((p) => (
              <div key={p.projectId} className="flex items-center justify-between text-sm">
                <span className="text-ink">{p.projectName}</span>
                <span className="text-ink-muted">{p.hours}h</span>
              </div>
            ))}
            {data.projectLabour.byProject.length === 0 && <p className="text-sm text-ink-faint">{t("hrDashboard.noVerifiedHours")}</p>}
            <Link href="/dashboard/hr/workforce-planning" className="block pt-1 text-xs text-gold hover:underline">{t("hrDashboard.utilization")}: {data.projectLabour.utilizationPct}%</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.inventory.workInbox")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.workInbox.map((ts) => (
              <Link key={ts.id} href="/dashboard/hr/timesheets" className="block text-sm text-ink hover:text-gold">
                {ts.employment.employee.fullName} — {t("hrDashboard.week")} {formatDate(ts.weekStartDate)}
              </Link>
            ))}
            {data.workInbox.length === 0 && <p className="text-sm text-ink-faint">{t("dashboards.workInboxEmpty")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.recentActivity")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                {a.actor && <Avatar name={a.actor.displayName} size={20} />}
                <div>
                  <p className="text-ink">{a.summary}</p>
                  <p className="text-xs text-ink-faint">{formatDate(a.createdAt)}</p>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
