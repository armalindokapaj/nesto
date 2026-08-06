import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listReportDefinitions } from "@/server/analytics";
import { getConfigResolver } from "@/server/platform-config";
import { archiveReportDefinitionAction } from "@/app/actions/analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateReportDialog } from "@/components/analytics/create-report-dialog";
import { ReportRunner } from "@/components/analytics/report-runner";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ReportLibraryPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("analytics.page.reports")) redirect("/analytics");
  const canWrite = can(role, "PROJECTS", "WRITE");

  const reports = await listReportDefinitions(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("analytics.title")}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("analytics.reportLibrary")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("analytics.reportLibrarySubtitle")}</p>
        </div>
        {canWrite && <CreateReportDialog />}
      </div>

      <div className="space-y-4">
        {reports.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{r.name}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {t(`analytics.kind_${r.kind}`)}
                  {r.executions[0] && ` · ${t("analytics.lastRun")} ${formatDate(r.executions[0].executedAt)} (${r.executions[0].rowCount} ${t("analytics.rows")})`}
                </p>
                {r.description && <p className="mt-1 text-xs text-ink-muted">{r.description}</p>}
              </div>
              {canWrite && (
                <form action={archiveReportDefinitionAction.bind(null, r.id)}>
                  <Button size="sm" variant="secondary" type="submit"><Archive size={14} /> {t("common.archive")}</Button>
                </form>
              )}
            </CardHeader>
            <CardContent>
              <ReportRunner reportId={r.id} reportName={r.name} />
            </CardContent>
          </Card>
        ))}
        {!reports.length && <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-faint">{t("analytics.noReports")}</div>}
      </div>
    </div>
  );
}
