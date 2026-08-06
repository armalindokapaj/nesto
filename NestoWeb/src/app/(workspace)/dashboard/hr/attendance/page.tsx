import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listShiftDefinitions, listScheduleAssignments, listAttendanceSummary, getEmployeeByUserId, getTodayClockState } from "@/server/attendance";
import { listReportableEmployees } from "@/server/hr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateShiftDialog, AssignScheduleForm, EndAssignmentButton, ClockButton } from "@/components/attendance/attendance-dialogs";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  COMPLETE: "success",
  IN_PROGRESS: "info",
  INCOMPLETE: "warning",
};

export default async function AttendancePage() {
  const { tenantId, role, user, company } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hr.page.attendance")) redirect("/dashboard/hr");
  const canManage = can(role, "HR", "WRITE");

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);

  const [shifts, assignments, summary, myEmployee] = await Promise.all([
    listShiftDefinitions(tenantId),
    listScheduleAssignments(tenantId),
    listAttendanceSummary(tenantId, from, to),
    getEmployeeByUserId(tenantId, user.id),
  ]);
  const employees = canManage ? await listReportableEmployees(tenantId) : [];
  const myClockState = myEmployee ? await getTodayClockState(tenantId, myEmployee.id) : null;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.attendanceTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.attendanceSubtitle")}</p>
        </div>
        {canManage && <CreateShiftDialog />}
      </div>

      {myEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>{t("attendance.myAttendance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ClockButton clockedIn={myClockState?.clockedIn ?? false} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("attendance.schedules")}</CardTitle>
            <CardDescription>{t("attendance.schedulesSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && <AssignScheduleForm employees={employees} shifts={shifts} />}
          <Table>
            <THead>
              <TRow>
                <TH>{t("attendance.employee")}</TH>
                <TH>{t("attendance.shift")}</TH>
                <TH>{t("attendance.hours")}</TH>
                <TH>{t("attendance.daysOfWeek")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {assignments.map((a) => (
                <TRow key={a.id}>
                  <TD className="text-ink font-medium">{a.employee.fullName}</TD>
                  <TD className="text-ink-muted">{a.shiftDefinition.name}</TD>
                  <TD className="text-ink-muted">{a.shiftDefinition.startTime}–{a.shiftDefinition.endTime}</TD>
                  <TD className="text-ink-muted">{a.shiftDefinition.daysOfWeek.split(",").map((d) => t(`attendance.day_${d}`)).join(", ")}</TD>
                  <TD>{canManage && <EndAssignmentButton assignmentId={a.id} />}</TD>
                </TRow>
              ))}
              {assignments.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("attendance.noAssignments")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("attendance.last7Days")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("attendance.employee")}</TH>
                <TH>{t("common.date")}</TH>
                <TH>{t("attendance.worked")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {summary.map((s) => (
                <TRow key={`${s.employeeId}:${s.date}`}>
                  <TD className="text-ink font-medium">{s.employeeName}</TD>
                  <TD className="text-ink-muted">{s.date}</TD>
                  <TD className="text-ink-muted">{Math.floor(s.workedMinutes / 60)}h {s.workedMinutes % 60}m</TD>
                  <TD><Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{t(`attendance.status_${s.status}`)}</Badge></TD>
                </TRow>
              ))}
              {summary.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("attendance.noRecords")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
