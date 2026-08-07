import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPayrollSummary } from "@/server/finance-payroll";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { formatSalaryAmount } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §4 "Payroll Summary" — reuses the existing Finance payroll summary
// (already shown on the old Company Overview) as its own sidebar page.
export default async function PayrollSummaryPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const payroll = await getPayrollSummary(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.payrollSummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payroll.length === 0 ? (
            <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.finance.noPayroll")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {payroll.map((p) => (
                <div key={p.currency} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <Users size={14} /> {p.headcount} {t("dashboards.finance.employees")} · {p.currency}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-ink-muted">{t("dashboards.finance.monthlyGross")}</p>
                      <p className="text-lg font-semibold text-ink">{formatSalaryAmount(p.monthlyGross, p.currency as "EUR" | "ALL")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">{t("dashboards.finance.monthlyNet")}</p>
                      <p className="text-lg font-semibold text-ink">{formatSalaryAmount(p.monthlyNet, p.currency as "EUR" | "ALL")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
