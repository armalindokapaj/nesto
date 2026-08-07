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

export default async function ProjectProcurementTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const orders = await db.purchaseOrder.findMany({
    where: { tenantId, projectId: id },
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { name: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="procurement" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabProcurement")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.supplier")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {orders.map((o) => (
                <TRow key={o.id}>
                  <TD>
                    <p className="font-medium text-ink">{o.number}</p>
                    <p className="text-xs text-ink-muted">{o.title}</p>
                  </TD>
                  <TD className="text-ink-muted">{o.supplier.name}</TD>
                  <TD className="text-ink-muted">{formatCurrency(o.amount, o.currency)}</TD>
                  <TD>
                    <Badge status={o.status}>{o.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {orders.length === 0 && (
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
