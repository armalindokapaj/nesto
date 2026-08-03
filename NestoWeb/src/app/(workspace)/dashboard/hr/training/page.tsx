import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listTrainingForHr } from "@/server/training";
import { listEmployees } from "@/server/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { AssignTrainingDialog } from "@/components/hr/assign-training-dialog";
import { TrainingStatusSelect } from "@/components/hr/training-status-select";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export default async function TrainingPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role as Role, "HR", "READ")) redirect("/dashboard/executive");
  const canManage = can(role as Role, "HR", "FULL");

  const [records, employees] = await Promise.all([
    listTrainingForHr(tenantId),
    canManage ? listEmployees(tenantId) : Promise.resolve([]),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.trainingTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.trainingSubtitle")}</p>
        </div>
        {canManage && <AssignTrainingDialog employees={employees} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("hr_sub.trainingName")}</TH>
                <TH>{t("hr_sub.trainingProvider")}</TH>
                <TH>{t("hr_sub.trainingDueDate")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {records.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.employee.fullName}</TD>
                  <TD className="text-ink-muted">{r.name}</TD>
                  <TD className="text-ink-muted">{r.provider ?? "—"}</TD>
                  <TD className="text-ink-muted whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : "—"}</TD>
                  <TD>
                    {canManage ? (
                      <TrainingStatusSelect trainingId={r.id} employeeId={r.employee.id} status={r.status} />
                    ) : (
                      t(`hr_sub.trainingStatus${r.status}`)
                    )}
                  </TD>
                </TRow>
              ))}
              {records.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("hr_sub.trainingEmpty")}
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
