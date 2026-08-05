import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listHazards, listProjectsForPicker } from "@/server/hse";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateHazardDialog } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function HazardsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [hazards, projects] = await Promise.all([listHazards(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.hazardsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.hazardsSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <CreateHazardDialog projects={projects} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("hse.hazardsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.hazardTitle")}</TH>
                <TH>{t("hse.category")}</TH>
                <TH>{t("hse.likelihood")}</TH>
                <TH>{t("hse.severity")}</TH>
                <TH>{t("hse.controlLevel")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {hazards.map((h) => (
                <TRow key={h.id}>
                  <TD className="text-ink font-medium">{h.title}</TD>
                  <TD className="text-ink-muted">{t(`hse.hazardCategory_${h.category}`)}</TD>
                  <TD className="text-ink-muted">{t(`hse.likelihood_${h.likelihood}`)}</TD>
                  <TD className="text-ink-muted">{t(`hse.severity_${h.severity}`)}</TD>
                  <TD className="text-ink-muted">{t(`hse.controlLevel_${h.controlLevel}`)}</TD>
                  <TD>
                    <Badge tone={h.status === "OPEN" ? "warning" : h.status === "CLOSED" ? "success" : "neutral"}>
                      {t(`hse.hazardStatus_${h.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(h.createdAt)}</TD>
                </TRow>
              ))}
              {hazards.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="py-8 text-center text-ink-faint">
                    {t("hse.noHazards")}
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
