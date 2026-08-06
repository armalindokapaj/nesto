import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listWorkflowDefinitions } from "@/server/workflow-engine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateWorkflowDefinitionDialog } from "@/components/workflow/workflow-dialogs";
import { getT } from "@/lib/i18n/server";

export default async function WorkflowDefinitionsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("workflow.page.definitions")) redirect("/dashboard/executive");

  const definitions = await listWorkflowDefinitions(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("workflow.definitions")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("workflow.definitionsSubtitle")}</p>
        </div>
        <CreateWorkflowDefinitionDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("workflow.key")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("workflow.sourceModule")}</TH>
                <TH>{t("workflow.stages")}</TH>
                <TH>{t("workflow.instances")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {definitions.map((d) => (
                <TRow key={d.id}>
                  <TD className="text-ink font-mono text-xs">{d.key}</TD>
                  <TD className="text-ink font-medium">{d.name}</TD>
                  <TD className="text-ink-muted">{d.sourceModule} / {d.sourceEntityType}</TD>
                  <TD className="text-ink-muted">{d.stages.map((s) => s.name).join(" → ")}</TD>
                  <TD className="text-ink-muted">{d._count.instances}</TD>
                  <TD><Badge tone={d.isActive ? "success" : "neutral"}>{d.isActive ? t("common.active") : t("common.inactive")}</Badge></TD>
                </TRow>
              ))}
              {definitions.length === 0 && (
                <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("workflow.noDefinitions")}</TD></TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
