import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo } from "@/server/finance-dashboard";
import { getBudget } from "@/server/finance-budget";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProjectBudgetTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const budgetRow = await db.budget.findFirst({ where: { tenantId, projectId: id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  const budget = budgetRow ? await getBudget(tenantId, budgetRow.id) : null;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="budget" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabBudget")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!budget ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-ink-faint">{t("dashboards.finance.noBudgets")}</p>
              <Link href="/dashboard/finance/budgets">
                <Button size="sm">{t("dashboards.finance.newBudget")}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-xs text-ink-muted">{t("dashboards.finance.baselineAmount")}</p>
                  <p className="text-lg font-semibold text-ink">{formatCurrency(budget.baselineAmount, budget.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">{t("dashboards.finance.committed")}</p>
                  <p className="text-lg font-semibold text-ink">{formatCurrency(budget.committed, budget.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">{t("dashboards.finance.actual")}</p>
                  <p className="text-lg font-semibold text-ink">{formatCurrency(budget.actual, budget.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">{t("dashboards.finance.remaining")}</p>
                  <p className={`text-lg font-semibold ${budget.remaining >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(budget.remaining, budget.currency)}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-ink mb-2">{t("dashboards.finance.revisionHistory")}</p>
              <Table>
                <THead>
                  <TRow>
                    <TH>{t("common.date")}</TH>
                    <TH>{t("dashboards.finance.baselineAmount")}</TH>
                    <TH>{t("common.description")}</TH>
                  </TRow>
                </THead>
                <TBody>
                  {budget.revisions.map((r) => (
                    <TRow key={r.id}>
                      <TD className="text-ink-muted whitespace-nowrap">{formatDate(r.revisedAt)}</TD>
                      <TD className="text-ink-muted">
                        {formatCurrency(r.previousAmount, budget.currency)} → {formatCurrency(r.newAmount, budget.currency)}
                      </TD>
                      <TD className="text-ink-muted">{r.reason ?? "—"}</TD>
                    </TRow>
                  ))}
                  {budget.revisions.length === 0 && (
                    <TRow>
                      <TD colSpan={3} className="py-6 text-center text-ink-faint">
                        —
                      </TD>
                    </TRow>
                  )}
                </TBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
