import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInvestments } from "@/server/finance-other";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateInvestmentDialog } from "@/components/finance/create-investment-dialog";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "FINANCE", "WRITE");
  const params = await searchParams;
  const investments = await listInvestments(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("dashboards.finance.investmentsTitle")}</CardTitle>
            <CardDescription>{t("dashboards.finance.investmentsSubtitle")}</CardDescription>
          </div>
          {canWrite && company && <CreateInvestmentDialog companyId={company.id} defaultOpen={params.open === "create"} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("dashboards.finance.investmentType")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("dashboards.finance.currentValue")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {investments.map((i) => (
                <TRow key={i.id}>
                  <TD className="font-medium text-ink">{i.name}</TD>
                  <TD className="text-ink-muted">{i.type}</TD>
                  <TD className="text-ink-muted">{formatCurrency(i.amount, i.currency)}</TD>
                  <TD className="text-ink-muted">{i.currentValue != null ? formatCurrency(i.currentValue, i.currency) : "—"}</TD>
                  <TD>
                    <Badge status={i.status}>{i.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {investments.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noInvestments")}
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
