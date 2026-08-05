import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { canViewSalary } from "@/server/employee-profile";
import { getPayrollRunDetail } from "@/server/payroll";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PayrollRunActions, CreateAdjustmentRunForm } from "@/components/hr/payroll-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const RUN_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  CALCULATED: "warning",
  LOCKED: "success",
  CANCELLED: "danger",
};

// PRD_HR_Payroll_Workforce Phase 2 route: /hr/payroll/runs/:id.
export default async function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "READ") || !canViewSalary({ userId: user.id, role })) redirect("/dashboard/hr");
  const canManage = can(role, "HR", "FULL");

  const detail = await getPayrollRunDetail(tenantId, id);
  if (!detail) notFound();
  const { run, activity } = detail;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr/payroll" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("payroll.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>
                {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
              </CardTitle>
              <Badge tone={RUN_TONE[run.status]}>{t(`payroll.runStatus_${run.status}`)}</Badge>
            </div>
            <CardDescription>
              {run.payrollGroup.name} ({run.payrollGroup.company.name}) · {t("payroll.payDate")}: {formatDate(run.payDate)}
              {run.adjustsRun && (
                <>
                  {" · "}
                  {t("payroll.adjustmentOf")}{" "}
                  <Link href={`/dashboard/hr/payroll/runs/${run.adjustsRun.id}`} className="hover:text-gold hover:underline">
                    {formatDate(run.adjustsRun.periodStart)} – {formatDate(run.adjustsRun.periodEnd)}
                  </Link>
                </>
              )}
              {run.lockedAt && ` · ${t("payroll.lockedOn")} ${formatDate(run.lockedAt)}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canManage && <PayrollRunActions runId={run.id} status={run.status} />}
            {canManage && run.status === "LOCKED" && run.adjustments.length === 0 && <CreateAdjustmentRunForm adjustsRunId={run.id} />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH className="text-right">{t("hr_sub.grossSalary")}</TH>
                <TH className="text-right">{t("hr_sub.netSalary")}</TH>
                <TH>{t("payroll.calculationTrace")}</TH>
              </TRow>
            </THead>
            <TBody>
              {run.lines.map((line) => (
                <TRow key={line.id}>
                  <TD>
                    <Link href={`/dashboard/hr/employees/${line.employee.id}`} className="flex items-center gap-2 hover:text-gold">
                      <Avatar name={line.employee.fullName} color={line.employee.avatarColor} size={24} />
                      <span className="font-medium text-ink">{line.employee.fullName}</span>
                    </Link>
                  </TD>
                  <TD className="text-right text-ink">
                    {line.currency} {line.grossSalary.toLocaleString()}
                  </TD>
                  <TD className="text-right text-ink-muted">
                    {line.currency} {line.netSalary.toLocaleString()}
                  </TD>
                  <TD className="text-xs text-ink-faint">{line.calculationTrace}</TD>
                </TRow>
              ))}
              {run.lines.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("payroll.noLines")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              {activity.map((event) => (
                <li key={event.id} className="flex items-start gap-2">
                  {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{event.summary}</p>
                    <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
