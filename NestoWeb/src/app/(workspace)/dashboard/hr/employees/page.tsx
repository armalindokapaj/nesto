import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/server/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateEmployeeDialog } from "@/components/hr/create-employee-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function EmployeesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "HR", "FULL");

  const employees = await listEmployees(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.employeesTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.employeesSubtitle")}</p>
        </div>
        {canCreate && <CreateEmployeeDialog />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("account.position")}</TH>
                <TH>{t("common.department")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {employees.map((e) => (
                <TRow key={e.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.fullName} color={e.avatarColor} size={28} />
                      <span className="font-medium text-ink">{e.fullName}</span>
                    </div>
                  </TD>
                  <TD className="text-ink-muted">{e.position}</TD>
                  <TD className="text-ink-muted">{e.department}</TD>
                  <TD>
                    <Badge status={e.status}>{e.status.replace("_", " ")}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(e.hireDate)}</TD>
                </TRow>
              ))}
              {employees.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("dashboards.hr.noEmployees")}
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
