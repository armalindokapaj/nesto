import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TerminateEmploymentButton } from "@/components/hr/terminate-employment-button";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §Offboarding — active employments (candidates for offboarding) plus every
// already-terminated one for record; terminating here is the real
// EmploymentRelationship state change (see hr.ts terminateEmployment), not a
// separate fabricated workflow.
export default async function OffboardingPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "HR", "FULL");

  const relationships = await db.employmentRelationship.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "TERMINATED"] } },
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: [{ status: "asc" }, { effectiveStartDate: "desc" }],
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.offboarding")}</CardTitle><CardDescription>{t("hrDashboard.offboardingSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("dashboards.hr.position")}</TH><TH>{t("common.status")}</TH><TH>{t("hrDashboard.effectiveTo")}</TH><TH /></TRow></THead>
            <TBody>
              {relationships.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.employee.fullName}</TD>
                  <TD className="text-ink-muted">{r.jobTitle}</TD>
                  <TD><Badge tone={r.status === "ACTIVE" ? "success" : "danger"}>{r.status}</Badge></TD>
                  <TD className="text-ink-muted">{r.effectiveEndDate ? formatDate(r.effectiveEndDate) : "—"}</TD>
                  <TD>{canManage && r.status === "ACTIVE" && <TerminateEmploymentButton employmentId={r.id} />}</TD>
                </TRow>
              ))}
              {relationships.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
