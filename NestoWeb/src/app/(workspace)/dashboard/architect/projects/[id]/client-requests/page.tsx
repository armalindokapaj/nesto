import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { db } from "@/lib/db";
import { listClientRequests } from "@/server/architecture";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchitectProjectTabs } from "@/components/dashboards/architect-project-tabs";
import { ClientRequestStatusSelect } from "@/components/architecture/client-request-status-select";
import { getT } from "@/lib/i18n/server";

export default async function ProjectClientRequestsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await db.project.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
  const requests = await listClientRequests(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <Badge status={project.status}>{project.status}</Badge>
      </div>
      <ArchitectProjectTabs projectId={id} active="client-requests" />
      <Table>
        <THead>
          <TRow>
            <TH>{t("nav.clients")}</TH>
            <TH>{t("common.category")}</TH>
            <TH>{t("common.status")}</TH>
          </TRow>
        </THead>
        <TBody>
          {requests.map((r) => (
            <TRow key={r.id}>
              <TD className="font-medium text-ink">{r.client.name}</TD>
              <TD className="text-ink-muted">{r.requestType}</TD>
              <TD>{canWrite ? <ClientRequestStatusSelect id={r.id} status={r.status} /> : <Badge status={r.status}>{r.status}</Badge>}</TD>
            </TRow>
          ))}
          {requests.length === 0 && (
            <TRow>
              <TD colSpan={3} className="py-8 text-center text-ink-faint">
                {t("dashboards.architect.noClientRequests")}
              </TD>
            </TRow>
          )}
        </TBody>
      </Table>
    </div>
  );
}
