import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo } from "@/server/finance-dashboard";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §10 Contracts tab — "Finance view of contract obligations, receivables/
// payables ... value impact." Contracts stays owned by the Contracts module
// (src/server/contracts.ts); this reads it filtered to the project only.
export default async function ProjectContractsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const contracts = await db.contract.findMany({
    where: { tenantId, projectId: id },
    orderBy: { createdAt: "desc" },
    include: { invoices: { select: { id: true, type: true, amount: true, status: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="contracts" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabContracts")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("dashboards.finance.budget")}</TH>
                <TH>{t("dashboards.finance.actual")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {contracts.map((c) => {
                const paid = c.invoices.filter((i) => i.status === "PAID" || i.status === "COMPLETED").reduce((s, i) => s + Math.abs(i.amount), 0);
                return (
                  <TRow key={c.id}>
                    <TD>
                      <p className="font-medium text-ink">{c.number}</p>
                      <p className="text-xs text-ink-muted">{c.title}</p>
                    </TD>
                    <TD className="text-ink-muted">{formatCurrency(c.value, c.currency)}</TD>
                    <TD className="text-ink-muted">{formatCurrency(paid, c.currency)}</TD>
                    <TD>
                      <Badge status={c.status}>{c.status}</Badge>
                    </TD>
                  </TRow>
                );
              })}
              {contracts.length === 0 && (
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
