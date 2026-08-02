import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listLeaveRequests, listEmployees } from "@/server/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateLeaveDialog } from "@/components/hr/create-leave-dialog";
import { LeaveDecisionButtons } from "@/components/hr/leave-decision-buttons";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function LeaveRequestsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canDecide = can(role, "HR", "FULL");
  const canCreate = can(role, "HR", "WRITE");

  const [requests, employees] = await Promise.all([
    listLeaveRequests(tenantId),
    canCreate ? listEmployees(tenantId) : Promise.resolve([]),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.leaveTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.leaveSubtitle")}</p>
        </div>
        {canCreate && <CreateLeaveDialog employees={employees} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("contracts.startDate")}</TH>
                <TH>{t("contracts.endDate")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.status")}</TH>
                {canDecide && <TH>{t("common.actions")}</TH>}
              </TRow>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.employee.fullName}</TD>
                  <TD className="text-ink-muted">{formatDate(r.startDate)}</TD>
                  <TD className="text-ink-muted">{formatDate(r.endDate)}</TD>
                  <TD className="text-ink-muted">{r.reason ?? "—"}</TD>
                  <TD>
                    <Badge status={r.status}>{r.status}</Badge>
                  </TD>
                  {canDecide && (
                    <TD>{r.status === "PENDING" && <LeaveDecisionButtons leaveRequestId={r.id} />}</TD>
                  )}
                </TRow>
              ))}
              {requests.length === 0 && (
                <TRow>
                  <TD colSpan={canDecide ? 6 : 5} className="text-center text-ink-faint py-8">
                    {t("dashboards.hr.noLeaveRequests")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
