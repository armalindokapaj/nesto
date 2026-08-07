import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listLoans } from "@/server/finance-other";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateLoanDialog } from "@/components/finance/create-loan-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "FINANCE", "WRITE");
  const params = await searchParams;
  const loans = await listLoans(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("dashboards.finance.loansTitle")}</CardTitle>
            <CardDescription>{t("dashboards.finance.loansSubtitle")}</CardDescription>
          </div>
          {canWrite && company && <CreateLoanDialog companyId={company.id} defaultOpen={params.open === "create"} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("dashboards.finance.lender")}</TH>
                <TH>{t("dashboards.finance.principal")}</TH>
                <TH>{t("dashboards.finance.outstanding")}</TH>
                <TH>{t("dashboards.finance.maturityDate")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {loans.map((l) => (
                <TRow key={l.id}>
                  <TD className="font-medium text-ink">{l.lender}</TD>
                  <TD className="text-ink-muted">{formatCurrency(l.principal, l.currency)}</TD>
                  <TD className="text-ink-muted">{formatCurrency(l.outstanding, l.currency)}</TD>
                  <TD className="text-ink-muted">{l.maturityDate ? formatDate(l.maturityDate) : "—"}</TD>
                  <TD>
                    <Badge status={l.status}>{l.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {loans.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noLoans")}
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
