import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCeoOrchestrationSummary } from "@/server/task-orchestration";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_4 §13.1/§13.3 — the CEO executive summary. Read-only: CTO-013/CTO-005
// give the CEO (and other TASKS-privileged roles) full visibility into every
// orchestrated task's status, blocker and forecast without adding them to
// any approval queue.
export default async function TaskOrchestrationOverviewPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");

  const rows = await getCeoOrchestrationSummary(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("orchestration.overviewTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("orchestration.overviewSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("task.title")}</TH>
                <TH>{t("orchestration.currentStage")}</TH>
                <TH>{t("orchestration.nextResponsible")}</TH>
                <TH>{t("orchestration.age")}</TH>
                <TH>{t("orchestration.blocker")}</TH>
                <TH>{t("orchestration.forecast")}</TH>
                <TH>{t("orchestration.commercialImpact")}</TH>
              </TRow>
            </THead>
            <TBody>
              {rows.map(({ task, ageDays, overdueDays, blocker, nextResponsible, forecast, commercialImpact }) => (
                <TRow key={task.id}>
                  <TD>
                    <Link href={`/tasks/${task.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                      {task.title}
                    </Link>
                    <p className="text-xs text-ink-faint">{task.code}</p>
                  </TD>
                  <TD>
                    <Badge status={task.orchestrationStatus ?? undefined}>{(task.orchestrationStatus ?? "").replace(/_/g, " ")}</Badge>
                    <p className="text-xs text-ink-faint mt-1">{task.currentStage?.label}</p>
                  </TD>
                  <TD className="text-ink-muted">{nextResponsible?.displayName ?? "—"}</TD>
                  <TD>
                    <span className="text-ink-muted">{ageDays}d</span>
                    {overdueDays > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-danger">
                        <AlertTriangle size={11} /> {overdueDays}d {t("orchestration.overdue")}
                      </span>
                    )}
                  </TD>
                  <TD className="text-ink-muted text-xs max-w-[220px]">{blocker ?? "—"}</TD>
                  <TD className="text-ink-muted">{forecast ? formatDate(forecast) : "—"}</TD>
                  <TD className="text-ink-muted">{commercialImpact != null ? formatCurrency(commercialImpact) : "—"}</TD>
                </TRow>
              ))}
              {rows.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="text-center text-ink-faint py-10">
                    {t("orchestration.noOrchestratedTasks")}
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
