import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInductions, listToolboxTalks, listProjectsForPicker } from "@/server/hse";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { CreateInductionDialog, CreateToolboxTalkDialog } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { isInductionValid } from "@/lib/hse";
import { Badge } from "@/components/ui/badge";

export default async function InductionsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hse.page.inductions")) redirect("/dashboard/hse");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [inductions, talks, projects] = await Promise.all([listInductions(tenantId), listToolboxTalks(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.inductionsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.inductionsSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && (
          <div className="flex gap-2">
            <CreateInductionDialog projects={projects} />
            <CreateToolboxTalkDialog projects={projects} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.newInduction")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.workerName")}</TH>
                <TH>{t("hse.workerCompany")}</TH>
                <TH>{t("hse.topicsCovered")}</TH>
                <TH>{t("hse.expiresAt")}</TH>
                <TH>{t("hse.conductedBy")}</TH>
              </TRow>
            </THead>
            <TBody>
              {inductions.map((i) => (
                <TRow key={i.id}>
                  <TD className="text-ink font-medium">{i.workerName}</TD>
                  <TD className="text-ink-muted">{i.workerCompany ?? "—"}</TD>
                  <TD className="text-ink-muted">{i.topicsCovered ?? "—"}</TD>
                  <TD>{i.expiresAt ? <Badge tone={isInductionValid(i.expiresAt) ? "success" : "danger"}>{formatDate(i.expiresAt)}</Badge> : "—"}</TD>
                  <TD className="text-ink-muted">{i.conductedBy.displayName} · {formatDate(i.conductedAt)}</TD>
                </TRow>
              ))}
              {inductions.length === 0 && (
                <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("hse.noInductions")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.toolboxTalksTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.topic")}</TH>
                <TH>{t("hse.attendeeCount")}</TH>
                <TH>{t("hse.notes")}</TH>
                <TH>{t("hse.conductedBy")}</TH>
              </TRow>
            </THead>
            <TBody>
              {talks.map((tk) => (
                <TRow key={tk.id}>
                  <TD className="text-ink font-medium">{tk.topic}</TD>
                  <TD className="text-ink-muted">{tk.attendeeCount}</TD>
                  <TD className="text-ink-muted">{tk.notes ?? "—"}</TD>
                  <TD className="text-ink-muted">{tk.conductedBy.displayName} · {formatDate(tk.conductedAt)}</TD>
                </TRow>
              ))}
              {talks.length === 0 && (
                <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("hse.noToolboxTalks")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
