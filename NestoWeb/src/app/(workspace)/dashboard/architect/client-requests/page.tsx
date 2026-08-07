import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listClientRequests } from "@/server/architecture";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientRequestStatusSelect } from "@/components/architecture/client-request-status-select";
import { ClientRequestAssignButton } from "@/components/architecture/client-request-assign-button";
import { getT } from "@/lib/i18n/server";

// PRD_Architect_Dashboard §20 — floor-plan/customisation requests. Sales/CRM
// creates them (bare clientId/unitId refs); Architecture owns the design
// work state only. Privacy boundary: no unrelated CRM fields exposed.
export default async function ClientRequestsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const requests = await listClientRequests(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("dashboards.architect.clientRequestsTitle")}</CardTitle>
            <CardDescription>{t("dashboards.architect.clientRequestsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("dashboards.finance.submitter")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.client.name}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/architect/projects/${r.project.id}/client-requests`} className="hover:text-gold hover:underline">
                      {r.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{r.requestType}</TD>
                  <TD className="text-ink-muted">{r.assignedArchitect?.displayName ?? (canWrite ? <ClientRequestAssignButton id={r.id} userId={user.id} /> : "—")}</TD>
                  <TD>{canWrite ? <ClientRequestStatusSelect id={r.id} status={r.status} /> : <Badge status={r.status}>{r.status}</Badge>}</TD>
                </TRow>
              ))}
              {requests.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.architect.noClientRequests")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
