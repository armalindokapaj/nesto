import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPersonalCalendarItems, getEmployeeForUser, getDirectReports } from "@/server/calendar";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PersonalMonthCalendar } from "@/components/calendar/personal-month-calendar";
import { RequestLeaveDialog } from "@/components/calendar/request-leave-dialog";
import { AgendaEventDialog } from "@/components/calendar/agenda-event-dialog";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { CALENDAR_ITEM_TONE } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const TONE_DOT_CLASSES: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-faint",
  gold: "bg-gold",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { tenantId, role, user } = await getCurrentUser();
  const { t } = await getT();
  const canCreateMeeting = can(role, "PROJECTS", "WRITE");

  const { month: monthParam } = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [items, own, projects] = await Promise.all([
    getPersonalCalendarItems(tenantId, user.id, { from, to }),
    getEmployeeForUser(tenantId, user.id),
    canCreateMeeting ? listProjects(tenantId) : Promise.resolve([]),
  ]);
  const reports = own ? await getDirectReports(tenantId, own.id) : [];
  const canRequestLeave = Boolean(own || reports.length > 0);

  const upcoming = items.filter((it) => it.date >= now).slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("calendar.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("calendar.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <PersonalMonthCalendar year={year} month={month} items={items} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("calendar.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <AgendaEventDialog />
              {canCreateMeeting && <CreateMeetingDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
              {canRequestLeave && (
                <RequestLeaveDialog own={own ? { id: own.id, fullName: own.fullName } : null} reports={reports} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("calendar.upcoming")}</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CalendarDays size={22} className="text-ink-faint" />
                  <p className="text-sm text-ink-faint">{t("calendar.nothingUpcoming")}</p>
                </div>
              ) : (
                <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {upcoming.map((it) => (
                    <li key={it.id} className="flex items-start gap-2.5">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT_CLASSES[CALENDAR_ITEM_TONE[it.source]])} />
                      <div className="min-w-0 flex-1">
                        {it.source === "AGENDA" ? (
                          <p className="text-sm font-medium text-ink truncate">{it.title}</p>
                        ) : (
                          <Link href={it.href} className="text-sm font-medium text-ink truncate hover:text-gold hover:underline block">
                            {it.title}
                          </Link>
                        )}
                        <p className="text-xs text-ink-muted">{formatDate(it.date, { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
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
