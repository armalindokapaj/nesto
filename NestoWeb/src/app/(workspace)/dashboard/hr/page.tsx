import { redirect } from "next/navigation";
import { Users, UserPlus, CalendarClock, Briefcase } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getHrDashboardData } from "@/server/hr";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function HrDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const data = await getHrDashboardData(tenantId);
  const { t } = await getT();
  const pendingLeaveLabel = `${data.pendingLeaveCount} ${t(data.pendingLeaveCount === 1 ? "dashboards.hr.pendingRequest" : "dashboards.hr.pendingRequests")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("dashboards.hr.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("dashboards.hr.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.hr.totalEmployees")} value={String(data.totalEmployees)} icon={Users} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/hr/employees" />
        <StatTile label={t("dashboards.hr.newHires")} value={String(data.newHiresCount)} icon={UserPlus} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/hr/employees" />
        <StatTile label={t("dashboards.hr.onLeave")} value={String(data.onLeaveCount)} icon={CalendarClock} iconColor="#B76E00" iconBg="#FBECD2" helper={pendingLeaveLabel} href="/dashboard/hr/leave" />
        <StatTile label={t("dashboards.hr.openPositions")} value={String(data.openPositions)} icon={Briefcase} iconColor="#4a3aa7" iconBg="#EEEAFB" helper={t("dashboards.hr.recruitmentSoon")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboards.hr.recentHires")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentHires.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.hr.noEmployees")}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentHires.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={e.fullName} color={e.avatarColor} size={30} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{e.fullName}</p>
                        <p className="text-xs text-ink-muted truncate">{e.position} · {e.department}</p>
                      </div>
                    </div>
                    <span className="text-xs text-ink-faint shrink-0">{formatDate(e.hireDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.hr.employeeDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.distribution.length > 0 ? (
              <DonutChart data={data.distribution} centerLabel={t("dashboards.hr.employees")} centerValue={String(data.totalEmployees)} />
            ) : (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.hr.noDepartments")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.hr.leaveRequestsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.leaveRequests.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.hr.noLeaveRequests")}</p>
            ) : (
              <ul className="space-y-3">
                {data.leaveRequests.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{l.employee.fullName}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </p>
                    </div>
                    <Badge status={l.status}>{l.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.hr.upcomingBirthdays")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.hr.noBirthdays")}</p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingBirthdays.map(({ employee, next }) => (
                  <li key={employee.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={employee.fullName} color={employee.avatarColor} size={28} />
                      <p className="font-medium text-ink truncate">{employee.fullName}</p>
                    </div>
                    <span className="text-xs text-ink-muted shrink-0">{formatDate(next)}</span>
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
