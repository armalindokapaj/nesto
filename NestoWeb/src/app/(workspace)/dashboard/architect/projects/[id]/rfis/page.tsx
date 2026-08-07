import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProjectRfisTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const rfis = await db.rFI.findMany({ where: { tenantId, projectId: id }, orderBy: { createdAt: "desc" } });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <ArchitectProjectTabs projectId={id} active="rfis" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("common.description")}</TH>
            <TH>{t("common.date")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {rfis.map((r) => (
            <TRow key={r.id}>
              <TD>
                <p className="font-medium text-ink">{r.code} · {r.title}</p>
                {r.response && <p className="text-xs text-ink-muted">{r.response}</p>}
              </TD>
              <TD className="text-ink-muted whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : "—"}</TD>
              <TD>
                <Badge status={r.status}>{r.status}</Badge>
              </TD>
            </TRow>
          ))}
          {rfis.length === 0 && (
            <TRow>
              <TD colSpan={3} className="py-8 text-center text-ink-faint">
                {t("dashboards.architect.noRfis")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
