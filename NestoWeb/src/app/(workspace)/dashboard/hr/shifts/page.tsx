import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listShiftDefinitions, listScheduleAssignments } from "@/server/attendance";
import { listReportableEmployees } from "@/server/hr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { CreateShiftDialog, AssignScheduleForm, EndAssignmentButton } from "@/components/attendance/attendance-dialogs";
import { getT } from "@/lib/i18n/server";

// PRD_HR_Dashboard §Workforce — Shifts & Rosters. Pulled out of the
// Attendance page (which keeps the clock-in/attendance-summary content) into
// its own leaf; both share the same ShiftDefinition/ScheduleAssignment data
// and components — no duplicated logic, just a focused view.
export default async function ShiftsAndRostersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "HR", "WRITE");

  const [shifts, assignments] = await Promise.all([listShiftDefinitions(tenantId), listScheduleAssignments(tenantId)]);
  const employees = canManage ? await listReportableEmployees(tenantId) : [];
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("nav.shiftsAndRosters")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("attendance.schedulesSubtitle")}</p>
        </div>
        {canManage && <CreateShiftDialog />}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("attendance.schedules")}</CardTitle>
            <CardDescription>{shifts.length} {t("hr_sub.attendanceTitle")}</CardDescription>
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
    </div>
  );
}
