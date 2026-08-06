import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listIncidents, listProjectsForPicker } from "@/server/hse";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateIncidentDialog } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  REPORTED: "warning",
  UNDER_INVESTIGATION: "warning",
  ACTION_PENDING: "warning",
  CLOSED: "success",
};

export default async function IncidentsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hse.page.incidents")) redirect("/dashboard/hse");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [incidents, projects] = await Promise.all([listIncidents(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.incidentsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.incidentsSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <CreateIncidentDialog projects={projects} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.incidentsTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.hazardTitle")}</TH>
                <TH>{t("hse.category")}</TH>
                <TH>{t("hse.occurredAt")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hse.correctiveActionsTitle")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {incidents.map((i) => (
                <TRow key={i.id}>
                  <TD className="text-ink font-medium">{i.title}</TD>
                  <TD className="text-ink-muted">{t(`hse.incidentClassification_${i.classification}`)}</TD>
                  <TD className="text-ink-muted">{formatDate(i.occurredAt)}</TD>
                  <TD><Badge tone={STATUS_TONE[i.status]}>{t(`hse.incidentStatus_${i.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{i.correctiveActions.filter((a) => a.status !== "COMPLETED").length} {t("hse.correctiveActionStatus_OPEN").toLowerCase()}</TD>
                  <TD><Link href={`/dashboard/hse/incidents/${i.id}`} className="text-sm text-gold hover:underline">{t("common.view")}</Link></TD>
                </TRow>
              ))}
              {incidents.length === 0 && (
                <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("hse.noIncidents")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
