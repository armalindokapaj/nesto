import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { getT } from "@/lib/i18n/server";

export default async function ProjectDrawingsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const drawings = await db.drawing.findMany({ where: { tenantId, projectId: id }, orderBy: { updatedAt: "desc" } });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <ArchitectProjectTabs projectId={id} active="drawings" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("common.description")}</TH>
            <TH>{t("dashboards.architect.revision")}</TH>
            <TH>{t("common.status")}</TH>
            <TH>{t("dashboards.architect.updated")}</TH>
          </TRow>
        </THead>
        <TBody>
          {drawings.map((d) => (
            <TRow key={d.id}>
              <TD className="font-medium text-ink">{d.packageName}</TD>
              <TD className="text-ink-muted">{d.revisionCode}</TD>
              <TD>
                <Badge status={d.status}>{d.status.replace("_", " ")}</Badge>
              </TD>
              <TD className="text-ink-muted whitespace-nowrap">{d.updatedAt.toLocaleDateString()}</TD>
            </TRow>
          ))}
          {drawings.length === 0 && (
            <TRow>
              <TD colSpan={4} className="py-8 text-center text-ink-faint">
                {t("dashboards.architect.noPackages")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
