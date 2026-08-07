import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo } from "@/server/finance-dashboard";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { InvoiceTypeTable } from "@/components/dashboards/invoice-type-table";
import { getT } from "@/lib/i18n/server";

export default async function ProjectRevenueTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const rows = await db.invoice.findMany({ where: { tenantId, projectId: id, type: "INVOICE" }, orderBy: { issuedDate: "desc" } });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="revenue" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabRevenue")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InvoiceTypeTable rows={rows} emptyKey="dashboards.finance.noRevenue" />
        </CardContent>
      </Card>
    </div>
  );
}
