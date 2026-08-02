import { redirect } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getMonthCalendarData, getCurrentWeekLeave } from "@/server/hr-calendar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { MonthCalendar } from "@/components/hr/calendar/month-calendar";
import { CreateAppointmentDialog } from "@/components/hr/calendar/create-appointment-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function HrCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "HR", "WRITE");

  const { month: monthParam } = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const [{ leaveEntries, appointments }, weekOff] = await Promise.all([
    getMonthCalendarData(tenantId, year, month),
    getCurrentWeekLeave(tenantId),
  ]);
  const { t } = await getT();

  const upcomingAppointments = appointments
    .filter((a) => new Date(a.scheduledAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.calendarTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.calendarSubtitle")}</p>
        </div>
        {canCreate && <CreateAppointmentDialog />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <MonthCalendar year={year} month={month} leaveEntries={leaveEntries} appointments={appointments} canCreate={canCreate} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t("hr_sub.offThisWeek")}</CardTitle>
                <CardDescription>
                  {formatDate(weekOff.weekStart)} – {formatDate(weekOff.weekEnd)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {weekOff.leaveEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CalendarOff size={22} className="text-ink-faint" />
                  <p className="text-sm text-ink-faint">{t("hr_sub.noOneOff")}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {weekOff.leaveEntries.map((l) => (
                    <li key={l.id} className="flex items-center gap-2.5">
                      <Avatar name={l.employee.fullName} color={l.employee.avatarColor} size={26} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{l.employee.fullName}</p>
                        <p className="text-xs text-ink-muted">
                          {formatDate(l.startDate)} – {formatDate(l.endDate)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("hr_sub.upcomingAppointments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-ink-faint py-6 text-center">{t("hr_sub.noAppointments")}</p>
              ) : (
                <ul className="space-y-3">
                  {upcomingAppointments.map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium text-ink">{a.title}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDate(a.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
                        {a.candidateName ? ` · ${a.candidateName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
