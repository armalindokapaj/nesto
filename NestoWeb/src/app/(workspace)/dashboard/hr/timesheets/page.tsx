import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getEmployeeByUserId } from "@/server/attendance";
import { getOrCreateTimesheet, listTimesheets } from "@/server/hr-timesheets";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TimesheetWeekEditor } from "@/components/hr/timesheet-week-editor";
import { TimesheetVerifyActions } from "@/components/hr/timesheet-verify-actions";
import { getT } from "@/lib/i18n/server";

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function TimesheetsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canVerify = can(role, "HR", "WRITE") || can(role, "HR", "FULL");

  const [employee, projects] = await Promise.all([getEmployeeByUserId(tenantId, user.id), listProjects(tenantId)]);
  const employment = employee ? await db.employmentRelationship.findFirst({ where: { tenantId, employeeId: employee.id, status: "ACTIVE" } }) : null;

  const weekStart = mondayOf(new Date());
  const myTimesheet = employment ? await getOrCreateTimesheet(tenantId, employment.id, weekStart) : null;
  const myTimesheetDetail = myTimesheet
    ? await db.timesheet.findUnique({ where: { id: myTimesheet.id }, include: { lines: true } })
    : null;

  const pending = canVerify ? await listTimesheets(tenantId, { status: "SUBMITTED" }) : [];
  const { t } = await getT();

  return (
    <div className="space-y-6">
      {myTimesheetDetail && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("nav.timesheets")}</CardTitle>
              <CardDescription>{t("hrDashboard.thisWeek")} · <Badge tone={myTimesheetDetail.status === "VERIFIED" ? "success" : myTimesheetDetail.status === "REJECTED" ? "danger" : "warning"}>{myTimesheetDetail.status}</Badge></CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {myTimesheetDetail.rejectionReason && <p className="mb-3 text-xs text-danger">{myTimesheetDetail.rejectionReason}</p>}
            <TimesheetWeekEditor
              timesheetId={myTimesheetDetail.id}
              weekStart={weekStart.toISOString()}
              status={myTimesheetDetail.status}
              existingLines={myTimesheetDetail.lines.map((l) => ({ date: l.date.toISOString(), projectId: l.projectId, hours: l.hours }))}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            />
          </CardContent>
        </Card>
      )}
      {!employee && (
        <Card><CardContent className="py-6 text-sm text-ink-faint">{t("hrDashboard.noEmployeeProfile")}</CardContent></Card>
      )}

      {canVerify && (
        <Card>
          <CardHeader><CardTitle>{t("hrDashboard.pendingVerification")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TRow><TH>{t("common.name")}</TH><TH>{t("hrDashboard.week")}</TH><TH className="text-right">{t("hrDashboard.totalHours")}</TH><TH /></TRow></THead>
              <TBody>
                {pending.map((ts) => (
                  <TRow key={ts.id}>
                    <TD className="font-medium text-ink">{ts.employment.employee.fullName}</TD>
                    <TD className="text-ink-muted">{ts.weekStartDate.toDateString()}</TD>
                    <TD className="text-right text-ink">{ts.totalHours}</TD>
                    <TD><TimesheetVerifyActions id={ts.id} /></TD>
                  </TRow>
                ))}
                {pending.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
