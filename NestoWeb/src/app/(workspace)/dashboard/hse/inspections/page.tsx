import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInspectionsPage, listProjectsForPicker } from "@/server/hse";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateInspectionDialog, CompleteInspectionActions } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { parsePageParams } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";

const OUTCOME_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "neutral",
  PASS: "success",
  CONDITIONAL: "warning",
  FAIL: "danger",
};

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = parsePageParams(await searchParams);
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hse.page.inspections")) redirect("/dashboard/hse");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [inspectionsPage, projects] = await Promise.all([listInspectionsPage(tenantId, params), listProjectsForPicker(tenantId)]);
  const inspections = inspectionsPage.items;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.inspectionsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.inspectionsSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <CreateInspectionDialog projects={projects} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.inspectionsTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.category")}</TH>
                <TH>{t("hse.location")}</TH>
                <TH>{t("hse.findings")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {inspections.map((i) => (
                <TRow key={i.id}>
                  <TD className="text-ink font-medium">{t(`hse.inspectionType_${i.type}`)}</TD>
                  <TD className="text-ink-muted">{i.location ?? "—"}</TD>
                  <TD className="text-ink-muted">{i.findings ?? "—"}</TD>
                  <TD><Badge tone={OUTCOME_TONE[i.outcome]}>{t(`hse.inspectionOutcome_${i.outcome}`)}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(i.inspectedAt)}</TD>
                  <TD>{canWrite && <CompleteInspectionActions inspectionId={i.id} status={i.status} />}</TD>
                </TRow>
              ))}
              {inspections.length === 0 && (
                <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("hse.noInspections")}</TD></TRow>
              )}
            </TBody>
          </Table>
          <Pagination page={inspectionsPage.page} pageCount={inspectionsPage.pageCount} total={inspectionsPage.total} pageSize={inspectionsPage.pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
