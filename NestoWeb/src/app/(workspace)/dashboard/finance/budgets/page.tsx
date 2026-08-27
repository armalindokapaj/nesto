import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listBudgets } from "@/server/finance";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateBudgetDialog } from "@/components/finance/create-budget-dialog";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "FINANCE", "WRITE");
  const params = await searchParams;

  const [budgets, projects] = await Promise.all([listBudgets(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("dashboards.finance.budgetsTitle")}</CardTitle>
            <CardDescription>{t("dashboards.finance.budgetsSubtitle")}</CardDescription>
          </div>
          {canWrite && company && (
            <CreateBudgetDialog companyId={company.id} projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultOpen={params.open === "create"} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("dashboards.finance.period")}</TH>
                <TH>{t("dashboards.finance.baselineAmount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {budgets.map((b) => (
                <TRow key={b.id}>
                  <TD className="font-medium text-ink">{b.project?.name ?? t("dashboards.finance.scopeCompany")}</TD>
                  <TD className="text-ink-muted">{b.period}</TD>
                  <TD className="text-ink-muted">{formatCurrency(b.baselineAmount, b.currency)}</TD>
                  <TD>
                    <Badge status={b.status}>{b.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {budgets.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noBudgets")}
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
