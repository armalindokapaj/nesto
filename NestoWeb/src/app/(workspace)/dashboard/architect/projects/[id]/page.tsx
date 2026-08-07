import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectArchitectureOverview } from "@/server/architecture";
import { db } from "@/lib/db";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { getT } from "@/lib/i18n/server";
import { FileText, HelpCircle, UploadCloud, Contact } from "lucide-react";

// PRD_Architect_Dashboard §14 — Single Project Architecture Workspace,
// Overview tab. An Architecture lens over one Project; never a duplicate.
export default async function ArchitectProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const overview = await getProjectArchitectureOverview(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <ArchitectProjectTabs projectId={id} active="" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("nav.drawings")} value={String(overview.pendingDrawings)} icon={FileText} iconColor="#1A7F4E" iconBg="#E2F4EA" href={`/dashboard/architect/projects/${id}/drawings`} />
        <StatTile label={t("nav.rfis")} value={String(overview.openRfis)} icon={HelpCircle} iconColor="#B76E00" iconBg="#FBECD2" href={`/dashboard/architect/projects/${id}/rfis`} />
        <StatTile label={t("nav.submittals")} value={String(overview.openSubmittals)} icon={UploadCloud} iconColor="#4a3aa7" iconBg="#EEEAFB" href={`/dashboard/architect/projects/${id}/submittals`} />
        <StatTile label={t("nav.clientRequests")} value={String(overview.openClientRequests)} icon={Contact} iconColor="#2457C5" iconBg="#E4ECFB" href={`/dashboard/architect/projects/${id}/client-requests`} />
      </div>
    </div>
  );
}
