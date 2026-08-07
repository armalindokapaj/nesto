import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { listEngineeringPackages } from "@/server/engineering";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EngineeringProjectTabs } from "@/components/dashboards/engineering-project-tabs";
import { CreateEngineeringPackageDialog } from "@/components/engineering/create-engineering-package-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ProjectPackagesTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const packages = await listEngineeringPackages(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
          <Badge status={project.status}>{project.status}</Badge>
        </div>
        {canWrite && <CreateEngineeringPackageDialog projects={[{ id, name: project.name }]} />}
      </div>
      <EngineeringProjectTabs projectId={id} active="packages" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("common.description")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {packages.map((p) => (
            <TRow key={p.id}>
              <TD className="font-medium text-ink">{p.code} · {p.title}</TD>
              <TD>
                <Badge status={p.status}>{p.status}</Badge>
              </TD>
            </TRow>
          ))}
          {packages.length === 0 && (
            <TRow>
              <TD colSpan={2} className="py-8 text-center text-ink-faint">
                {t("dashboards.engineer.noPackages")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
