import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getConfigResolver } from "@/server/platform-config";
import { listMyWorkItems, listMySubmittedWorkflows } from "@/server/workflow-engine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DecideWorkItemActions, ConfirmFinalizationButton, CancelWorkflowButton } from "@/components/workflow/workflow-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  SOURCE_FINALIZATION_PENDING: "warning",
  APPROVED: "success",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function MyApprovalsPage() {
  const { tenantId, role, user, company } = await getCurrentUser();
  if (!(await getConfigResolver(tenantId, company?.id))("workflow.page.inbox")) redirect("/dashboard/executive");

  const [workItems, submitted] = await Promise.all([listMyWorkItems(tenantId, user.id, role), listMySubmittedWorkflows(tenantId, user.id)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("workflow.myApprovals")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("workflow.myApprovalsSubtitle")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("workflow.pendingDecisions")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("workflow.definition")}</TH>
                <TH>{t("workflow.stage")}</TH>
                <TH>{t("workflow.submittedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
                <TH>{t("common.actions")}</TH>
              </TRow>
            </THead>
            <TBody>
              {workItems.map((wi) => (
                <TRow key={wi.id}>
                  <TD className="text-ink font-medium">{wi.workflowInstance.workflowDefinition.name}</TD>
                  <TD className="text-ink-muted">{wi.name}</TD>
                  <TD className="text-ink-muted">{wi.workflowInstance.submittedBy.displayName}</TD>
                  <TD className="text-ink-muted">{formatDate(wi.workflowInstance.submittedAt)}</TD>
                  <TD><DecideWorkItemActions stageInstanceId={wi.id} /></TD>
                </TRow>
              ))}
              {workItems.length === 0 && (
                <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("workflow.noPendingDecisions")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("workflow.mySubmissions")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("workflow.definition")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("workflow.stage")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
                <TH>{t("common.actions")}</TH>
              </TRow>
            </THead>
            <TBody>
              {submitted.map((wf) => (
                <TRow key={wf.id}>
                  <TD className="text-ink font-medium">{wf.workflowDefinition.name}</TD>
                  <TD><Badge tone={STATUS_TONE[wf.status] ?? "neutral"}>{t(`workflow.status_${wf.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{wf.stages.find((s) => s.sequence === wf.currentStageSequence)?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{formatDate(wf.submittedAt)}</TD>
                  <TD className="flex gap-2">
                    {wf.status === "SOURCE_FINALIZATION_PENDING" && <ConfirmFinalizationButton instanceId={wf.id} />}
                    {wf.status === "PENDING" && <CancelWorkflowButton instanceId={wf.id} />}
                  </TD>
                </TRow>
              ))}
              {submitted.length === 0 && (
                <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("workflow.noSubmissions")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
