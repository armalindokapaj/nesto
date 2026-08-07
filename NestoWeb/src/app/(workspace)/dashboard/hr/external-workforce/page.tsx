import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listExternalWorkforce } from "@/server/hr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ExternalWorkforcePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const relationships = await listExternalWorkforce(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.externalWorkforce")}</CardTitle><CardDescription>{t("hrDashboard.externalWorkforceSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("hrDashboard.employmentType")}</TH><TH>{t("dashboards.hr.position")}</TH><TH>{t("hrDashboard.company")}</TH><TH>{t("hrDashboard.effectiveFrom")}</TH></TRow></THead>
            <TBody>
              {relationships.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.employee.fullName}</TD>
                  <TD><Badge tone="neutral">{r.employmentType}</Badge></TD>
                  <TD className="text-ink-muted">{r.jobTitle}</TD>
                  <TD className="text-ink-muted">{r.company?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{formatDate(r.effectiveStartDate)}</TD>
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
