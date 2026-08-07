import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { listCalculations } from "@/server/engineering";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EngineeringProjectTabs } from "@/components/dashboards/engineering-project-tabs";
import { CreateCalculationDialog } from "@/components/engineering/create-calculation-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ProjectCalculationsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const calcs = await listCalculations(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
          <Badge status={project.status}>{project.status}</Badge>
        </div>
        {canWrite && <CreateCalculationDialog projects={[{ id, name: project.name }]} />}
      </div>
      <EngineeringProjectTabs projectId={id} active="calculations" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("common.description")}</TH>
            <TH>{t("crm.owner")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {calcs.map((c) => (
            <TRow key={c.id}>
              <TD className="font-medium text-ink">{c.code} · {c.title}</TD>
              <TD className="text-ink-muted">{c.author?.displayName ?? "—"}</TD>
              <TD>
                <Badge status={c.status}>{c.status}</Badge>
              </TD>
            </TRow>
          ))}
          {calcs.length === 0 && (
            <TRow>
              <TD colSpan={3} className="py-8 text-center text-ink-faint">
                {t("dashboards.engineer.noCalculations")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
