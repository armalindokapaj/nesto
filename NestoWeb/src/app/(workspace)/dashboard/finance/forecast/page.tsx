import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProjectFinancialPortfolio } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";

import { formatMinor } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export default async function ForecastPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const portfolio = await getProjectFinancialPortfolio(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.forecastingTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("dashboards.finance.budget")}</TH>
                <TH>{t("dashboards.finance.forecast")}</TH>
                <TH>{t("dashboards.finance.forecastVariance")}</TH>
              </TRow>
            </THead>
            <TBody>
              {portfolio.map((p) => (
                <TRow key={p.project.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/dashboard/finance/projects/${p.project.id}/forecast`} className="hover:text-gold hover:underline">
                      {p.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{formatMinor(p.budgetMinor)}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.forecastMinor)}</TD>
                  <TD className={p.forecastMinor - p.budgetMinor <= 0 ? "text-success" : "text-danger"}>{formatMinor(p.forecastMinor - p.budgetMinor)}</TD>
                </TRow>
              ))}
              {portfolio.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    —
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
