import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listObservations, listProjectsForPicker } from "@/server/hse";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateObservationDialog, CloseObservationButton } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  OPEN: "warning",
  ACTIONED: "neutral",
  CLOSED: "success",
};

export default async function ObservationsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hse.page.observations")) redirect("/dashboard/hse");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [observations, projects] = await Promise.all([listObservations(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.observationsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.observationsSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <CreateObservationDialog projects={projects} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.observationsTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.category")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("hse.severity")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hse.reportedBy")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {observations.map((o) => (
                <TRow key={o.id}>
                  <TD className="text-ink font-medium">{t(`hse.observationType_${o.type}`)}</TD>
                  <TD className="text-ink-muted">{o.description}</TD>
                  <TD className="text-ink-muted">{o.severity}</TD>
                  <TD><Badge tone={STATUS_TONE[o.status]}>{t(`hse.observationStatus_${o.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{o.reportedBy.displayName} · {formatDate(o.createdAt)}</TD>
                  <TD>{canWrite && o.status === "OPEN" && <CloseObservationButton observationId={o.id} />}</TD>
                </TRow>
              ))}
              {observations.length === 0 && (
                <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("hse.noObservations")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
