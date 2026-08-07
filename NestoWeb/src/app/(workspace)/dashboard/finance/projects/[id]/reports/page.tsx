import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo } from "@/server/finance-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { getT } from "@/lib/i18n/server";

// §10 Reports tab — "Permission-safe project financial reports." Reuses
// the platform's existing Reporting & Analytics module (/reports) filtered
// to this project, rather than a second reporting engine.
export default async function ProjectReportsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="reports" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabReports")}</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Link href={`/reports?projectId=${id}`}>
            <Button size="sm">{t("nav.reports")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
