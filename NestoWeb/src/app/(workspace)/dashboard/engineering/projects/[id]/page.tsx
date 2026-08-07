import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getProjectEngineeringOverview } from "@/server/engineering";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { EngineeringProjectTabs } from "@/components/dashboards/engineering-project-tabs";
import { getT } from "@/lib/i18n/server";
import { HelpCircle, UploadCloud, ShieldCheck, Network } from "lucide-react";

export default async function EngineeringProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const overview = await getProjectEngineeringOverview(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <EngineeringProjectTabs projectId={id} active="" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("nav.rfis")} value={String(overview.openRfis)} icon={HelpCircle} iconColor="#B76E00" iconBg="#FBECD2" href={`/dashboard/engineering/rfis?projectId=${id}`} />
        <StatTile label={t("nav.submittals")} value={String(overview.openSubmittals)} icon={UploadCloud} iconColor="#4a3aa7" iconBg="#EEEAFB" href={`/dashboard/engineering/submittals?projectId=${id}`} />
        <StatTile label={t("nav.inspections")} value={String(overview.pendingInspections)} icon={ShieldCheck} iconColor="#1A7F4E" iconBg="#E2F4EA" href={`/dashboard/engineering/inspections?projectId=${id}`} />
        <StatTile label={t("nav.coordination")} value={String(overview.coordinationOpen)} icon={Network} iconColor="#2457C5" iconBg="#E4ECFB" href={`/dashboard/engineering/coordination?projectId=${id}`} />
      </div>
    </div>
  );
}
