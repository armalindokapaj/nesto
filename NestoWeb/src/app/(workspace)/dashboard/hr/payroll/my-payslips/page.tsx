import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getEmployeePayslips } from "@/server/payroll";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// Self-service — any authenticated user with an Employee record sees their
// own locked payslips only, no HR gate. Mirrors the self-or-HR pattern used
// for Work Contract on the public profile (employee-profile.ts).
export default async function MyPayslipsPage() {
  const { tenantId, user } = await getCurrentUser();
  const { t } = await getT();

  const employee = await db.employee.findFirst({ where: { tenantId, userId: user.id } });
  const payslips = employee ? await getEmployeePayslips(tenantId, employee.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("payroll.myPayslips")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("payroll.myPayslipsSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("payroll.myPayslips")}</CardTitle>
          <CardDescription>{t("payroll.lockedOnlyHint")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("payroll.period")}</TH>
                <TH>{t("payroll.payDate")}</TH>
                <TH className="text-right">{t("hr_sub.grossSalary")}</TH>
                <TH className="text-right">{t("hr_sub.netSalary")}</TH>
              </TRow>
            </THead>
            <TBody>
              {payslips.map((line) => (
                <TRow key={line.id}>
                  <TD className="text-ink">
                    {formatDate(line.payrollRun.periodStart)} – {formatDate(line.payrollRun.periodEnd)}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(line.payrollRun.payDate)}</TD>
                  <TD className="text-right text-ink">
                    {line.currency} {line.grossSalary.toLocaleString()}
                  </TD>
                  <TD className="text-right text-ink-muted">
                    {line.currency} {line.netSalary.toLocaleString()}
                  </TD>
                </TRow>
              ))}
              {payslips.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("payroll.noPayslips")}
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
