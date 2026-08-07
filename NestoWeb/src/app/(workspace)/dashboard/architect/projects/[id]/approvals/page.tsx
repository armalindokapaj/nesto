import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { getT } from "@/lib/i18n/server";

// §19 Approvals — reads drawing revisions currently under review as the
// project's design-approval work items (Workflow Engine isn't wired to this
// record type yet; shown here as a direct source-state projection instead
// of fabricating a workflow instance).
export default async function ProjectApprovalsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const pending = await db.drawingRevision.findMany({
    where: { tenantId, drawing: { projectId: id }, status: "SUBMITTED" },
    orderBy: { createdAt: "desc" },
    include: { drawing: { select: { packageName: true } }, author: { select: { displayName: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <ArchitectProjectTabs projectId={id} active="approvals" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("nav.drawings")}</TH>
            <TH>{t("dashboards.architect.revision")}</TH>
            <TH>{t("crm.owner")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {pending.map((r) => (
            <TRow key={r.id}>
              <TD className="font-medium text-ink">{r.drawing.packageName}</TD>
              <TD className="text-ink-muted">{r.code}</TD>
              <TD className="text-ink-muted">{r.author.displayName}</TD>
              <TD>
                <Badge status={r.status}>{r.status}</Badge>
              </TD>
            </TRow>
          ))}
          {pending.length === 0 && (
            <TRow>
              <TD colSpan={4} className="py-8 text-center text-ink-faint">
                —
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
