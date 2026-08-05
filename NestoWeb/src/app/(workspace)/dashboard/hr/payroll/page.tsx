import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPayrollGroups, listPayrollRuns, listCompaniesForPicker } from "@/server/payroll";
import { canViewSalary } from "@/server/employee-profile";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreatePayrollGroupDialog, CreatePayrollRunDialog } from "@/components/hr/payroll-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const RUN_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  CALCULATED: "warning",
  LOCKED: "success",
  CANCELLED: "danger",
};

// PRD_HR_Payroll_Workforce Phase 2 — /hr/payroll. Confidential: gated the
// same way as Compensation on the employee detail page (canViewSalary), not
// merely HR/READ — this page shows every employee's pay.
export default async function PayrollPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "READ") || !canViewSalary({ userId: user.id, role })) redirect("/dashboard/hr");
  const canManage = can(role, "HR", "FULL");

  const [groups, runs, companies] = await Promise.all([
    listPayrollGroups(tenantId),
    listPayrollRuns(tenantId),
    listCompaniesForPicker(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("payroll.title")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("payroll.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && <CreatePayrollGroupDialog companies={companies} />}
          {canManage && groups.length > 0 && <CreatePayrollRunDialog groups={groups.map((g) => ({ id: g.id, name: g.name }))} />}
        </div>
      </div>

      {groups.length === 0 && canManage && <p className="text-sm text-ink-faint">{t("payroll.needGroupFirst")}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("payroll.groups")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("payroll.company")}</TH>
                <TH>{t("hr_sub.paymentFrequency")}</TH>
                <TH>{t("hr_sub.currency")}</TH>
              </TRow>
            </THead>
            <TBody>
              {groups.map((g) => (
                <TRow key={g.id}>
                  <TD className="text-ink font-medium">{g.name}</TD>
                  <TD className="text-ink-muted">{g.company.name}</TD>
                  <TD className="text-ink-muted">{t(`hr_sub.frequency${g.frequency}`)}</TD>
                  <TD className="text-ink-muted">{g.currency}</TD>
                </TRow>
              ))}
              {groups.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-6 text-center text-ink-faint">
                    {t("payroll.noGroups")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("payroll.runs")}</CardTitle>
          <CardDescription>{t("payroll.runsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("payroll.period")}</TH>
                <TH>{t("payroll.group")}</TH>
                <TH>{t("payroll.payDate")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("payroll.employees")}</TH>
              </TRow>
            </THead>
            <TBody>
              {runs.map((r) => (
                <TRow key={r.id}>
                  <TD>
                    <Link href={`/dashboard/hr/payroll/runs/${r.id}`} className="font-medium text-ink hover:text-gold">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{r.payrollGroup.name}</TD>
                  <TD className="text-ink-muted">{formatDate(r.payDate)}</TD>
                  <TD>
                    <Badge tone={RUN_TONE[r.status]}>{t(`payroll.runStatus_${r.status}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{r.lines.length}</TD>
                </TRow>
              ))}
              {runs.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("payroll.noRuns")}
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
