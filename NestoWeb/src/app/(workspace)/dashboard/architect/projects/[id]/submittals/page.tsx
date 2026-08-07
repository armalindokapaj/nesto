import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { listSubmittals } from "@/server/architecture";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { CreateSubmittalDialog } from "@/components/architecture/create-submittal-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ProjectSubmittalsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const submittals = await listSubmittals(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
          <Badge status={project.status}>{project.status}</Badge>
        </div>
        {canWrite && <CreateSubmittalDialog projectId={id} />}
      </div>
      <ArchitectProjectTabs projectId={id} active="submittals" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("common.description")}</TH>
            <TH>{t("common.category")}</TH>
            <TH>{t("dashboards.finance.submitter")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {submittals.map((s) => (
            <TRow key={s.id}>
              <TD className="font-medium text-ink">{s.number} · {s.title}</TD>
              <TD className="text-ink-muted">{s.type}</TD>
              <TD className="text-ink-muted">{s.submitter.displayName}</TD>
              <TD>
                <Badge status={s.status}>{s.status}</Badge>
              </TD>
            </TRow>
          ))}
          {submittals.length === 0 && (
            <TRow>
              <TD colSpan={4} className="py-8 text-center text-ink-faint">
                {t("dashboards.architect.noSubmittals")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
