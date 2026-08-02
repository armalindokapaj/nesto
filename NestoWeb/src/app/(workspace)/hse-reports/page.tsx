import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listHseReports } from "@/server/hse";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateHseReportDialog } from "@/components/hse/create-hse-report-dialog";
import { HseReportStatusSelect } from "@/components/hse/hse-report-status-select";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const SEVERITY_TONE: Record<string, "success" | "warning" | "danger"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

const STATUS_KEY: Record<string, string> = {
  OPEN: "hse.statusOpen",
  IN_PROGRESS: "task.inProgress",
  RESOLVED: "hse.statusResolved",
};

export default async function HseReportsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "HSE_REPORTS", "WRITE");

  const [reports, projects] = await Promise.all([listHseReports(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("hse.title")}</CardTitle>
            <CardDescription>{t("hse.subtitle")}</CardDescription>
          </div>
          {canCreate && <CreateHseReportDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("hse.severity")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hse.reportedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {reports.map((report) => (
                <TRow key={report.id}>
                  <TD>
                    <p className="font-medium text-ink">{report.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5 max-w-md">{report.description}</p>
                  </TD>
                  <TD className="text-ink-muted">
                    <Link href={`/projects/${report.project.id}`} className="hover:text-gold hover:underline">
                      {report.project.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={SEVERITY_TONE[report.severity] ?? "neutral"}>{t(`task.${report.severity.toLowerCase()}`)}</Badge>
                  </TD>
                  <TD>
                    {canCreate ? (
                      <HseReportStatusSelect reportId={report.id} status={report.status} />
                    ) : (
                      <Badge status={report.status}>{t(STATUS_KEY[report.status] ?? report.status)}</Badge>
                    )}
                  </TD>
                  <TD className="text-ink-muted">{report.reportedBy.displayName}</TD>
                  <TD className="text-ink-muted">{formatDate(report.createdAt)}</TD>
                </TRow>
              ))}
              {reports.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="text-center text-ink-faint py-8">
                    {t("hse.noReports")}
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
