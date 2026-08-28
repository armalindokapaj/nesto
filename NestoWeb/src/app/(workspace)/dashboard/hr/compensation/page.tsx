import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { canViewCompensation } from "@/server/employee-profile";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §Compensation & Benefits — the current SalaryRecord per employee (same
// model/gate the Employee Profile's salary tab already uses); "Benefits"
// has no data model yet, deliberately not fabricated.
export default async function CompensationPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!(await canViewCompensation(tenantId, { userId: user.id, role }))) redirect("/dashboard/hr");

  const records = await db.salaryRecord.findMany({
    where: { tenantId, status: "CURRENT" },
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: { effectiveStartDate: "desc" },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.compensationAndBenefits")}</CardTitle><CardDescription>{t("hrDashboard.compensationSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH className="text-right">{t("hrDashboard.grossSalary")}</TH><TH className="text-right">{t("hrDashboard.netSalary")}</TH><TH>{t("hrDashboard.frequency")}</TH><TH>{t("hrDashboard.effectiveFrom")}</TH></TRow></THead>
            <TBody>
              {records.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.employee.fullName}</TD>
                  <TD className="text-right text-ink">{r.grossSalary.toLocaleString()} {r.currency}</TD>
                  <TD className="text-right text-ink-muted">{r.netSalary.toLocaleString()} {r.currency}</TD>
                  <TD><Badge tone="neutral">{r.paymentFrequency}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(r.effectiveStartDate)}</TD>
                </TRow>
              ))}
              {records.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
