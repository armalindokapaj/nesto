import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §Employment Contracts — every EmploymentRelationship (the module's real
// employment record) with its contract type and effective dates; no
// separate signed-document model exists yet, this is the structured record
// itself, same as inventory-module's approach to "record the real data,
// don't fabricate a form nothing backs".
export default async function EmploymentContractsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const relationships = await db.employmentRelationship.findMany({
    where: { tenantId },
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: { effectiveStartDate: "desc" },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.employmentContracts")}</CardTitle><CardDescription>{t("hrDashboard.contractsSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("hrDashboard.contractType")}</TH><TH>{t("hrDashboard.employmentType")}</TH><TH>{t("hrDashboard.effectiveFrom")}</TH><TH>{t("hrDashboard.effectiveTo")}</TH><TH>{t("common.status")}</TH></TRow></THead>
            <TBody>
              {relationships.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink"><Link href={`/dashboard/hr/employees/${r.employee.id}`} className="hover:text-gold hover:underline">{r.employee.fullName}</Link></TD>
                  <TD className="text-ink-muted">{r.contractType}</TD>
                  <TD className="text-ink-muted">{r.employmentType}</TD>
                  <TD className="text-ink-muted">{formatDate(r.effectiveStartDate)}</TD>
                  <TD className="text-ink-muted">{r.effectiveEndDate ? formatDate(r.effectiveEndDate) : "—"}</TD>
                  <TD><Badge tone={r.status === "ACTIVE" ? "success" : r.status === "TERMINATED" ? "danger" : "neutral"}>{r.status}</Badge></TD>
                </TRow>
              ))}
              {relationships.length === 0 && <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
