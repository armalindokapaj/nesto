import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { canViewCompensation } from "@/server/employee-profile";
import { getEmployeeHrDetail, listReportableEmployees } from "@/server/hr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { RecordEmploymentDialog } from "@/components/hr/record-employment-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_HR_Payroll_Workforce Phase 1 route: /hr/employees/:id — the HR-internal
// management view, distinct from the company-wide public profile at
// /employees/:id (Employee Profile & Directory). This page owns the
// effective-dated EmploymentRelationship timeline and (HR/Finance-gated)
// compensation history; it never duplicates the public profile's photo/CV.
export default async function HrEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "HR", "FULL");
  const showCompensation = await canViewCompensation(tenantId, { userId: user.id, role });

  const [detail, managers] = await Promise.all([getEmployeeHrDetail(tenantId, id), listReportableEmployees(tenantId)]);
  if (!detail) notFound();
  const { employee, employmentRelationships, activity } = detail;
  const currentRelationship = employmentRelationships.find((r) => r.status === "ACTIVE");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr/employees" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("hr_sub.employeesTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar name={employee.fullName} color={employee.avatarColor} size={44} src={employee.photoDataUrl} />
            <div>
              <CardTitle>{employee.fullName}</CardTitle>
              <CardDescription>
                {currentRelationship?.jobTitle ?? employee.position} · {currentRelationship?.department ?? employee.department}
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <RecordEmploymentDialog
              employeeId={employee.id}
              currentJobTitle={currentRelationship?.jobTitle ?? employee.position}
              currentDepartment={currentRelationship?.department ?? employee.department}
              managers={managers}
              hasCurrentRelationship={Boolean(currentRelationship)}
            />
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge status={employee.status}>{employee.status.replace("_", " ")}</Badge>
          {currentRelationship && (
            <>
              <Badge tone="neutral">{t(`hr_sub.employmentType_${currentRelationship.employmentType}`)}</Badge>
              <Badge tone="neutral">{t(`hr_sub.contractType_${currentRelationship.contractType}`)}</Badge>
              {currentRelationship.reportsTo && (
                <Badge tone="neutral">
                  {t("hr_sub.reportsTo")}: {currentRelationship.reportsTo.fullName}
                </Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("hr_sub.employmentHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hr_sub.jobTitle")}</TH>
                <TH>{t("common.department")}</TH>
                <TH>{t("hr_sub.employmentType")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hr_sub.effectiveStartDate")}</TH>
                <TH>{t("hr_sub.effectiveEndDate")}</TH>
              </TRow>
            </THead>
            <TBody>
              {employmentRelationships.map((r) => (
                <TRow key={r.id}>
                  <TD className="text-ink">{r.jobTitle}</TD>
                  <TD className="text-ink-muted">{r.department}</TD>
                  <TD className="text-ink-muted">{t(`hr_sub.employmentType_${r.employmentType}`)}</TD>
                  <TD>
                    <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{t(`hr_sub.employmentStatus_${r.status}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(r.effectiveStartDate)}</TD>
                  <TD className="text-ink-muted">{r.effectiveEndDate ? formatDate(r.effectiveEndDate) : "—"}</TD>
                </TRow>
              ))}
              {employmentRelationships.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("hr_sub.noEmploymentHistory")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {showCompensation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("hr_sub.compensationHistory")}</CardTitle>
            <CardDescription>{t("hr_sub.compensationConfidentialHint")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TRow>
                  <TH>{t("hr_sub.grossSalaryMinor")}</TH>
                  <TH>{t("hr_sub.netSalaryMinor")}</TH>
                  <TH>{t("hr_sub.paymentFrequency")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("hr_sub.effectiveStartDate")}</TH>
                </TRow>
              </THead>
              <TBody>
                {employee.salaryRecords.map((s) => (
                  <TRow key={s.id}>
                    <TD className="text-ink">
                      {s.currency} {s.grossSalary.toLocaleString()}
                    </TD>
                    <TD className="text-ink-muted">
                      {s.currency} {s.netSalary.toLocaleString()}
                    </TD>
                    <TD className="text-ink-muted">{t(`hr_sub.frequency${s.paymentFrequency}`)}</TD>
                    <TD>
                      <Badge tone={s.status === "CURRENT" ? "success" : "neutral"}>{s.status}</Badge>
                    </TD>
                    <TD className="text-ink-muted">{formatDate(s.effectiveStartDate)}</TD>
                  </TRow>
                ))}
                {employee.salaryRecords.length === 0 && (
                  <TRow>
                    <TD colSpan={5} className="py-8 text-center text-ink-faint">
                      {t("hr_sub.noSalaryRecords")}
                    </TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
