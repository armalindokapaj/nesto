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
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";

export default async function ProjectSpendingsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const bills = await db.spendingBill.findMany({
    where: { tenantId, projectId: id },
    orderBy: { createdAt: "desc" },
    include: { submitter: { select: { displayName: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="spendings" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabSpendings")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("dashboards.finance.submitter")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {bills.map((b) => (
                <TRow key={b.id}>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(b.createdAt)}</TD>
                  <TD className="font-medium text-ink">{b.category}</TD>
                  <TD className="text-ink-muted">{formatMinor(b.amountMinor, b.currency)}</TD>
                  <TD className="text-ink-muted">{b.submitter.displayName}</TD>
                  <TD>
                    <Badge status={b.status}>{t(`dashboards.finance.status${toPascal(b.status)}`)}</Badge>
                  </TD>
                </TRow>
              ))}
              {bills.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noSpendingBills")}
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

function toPascal(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join("");
}
