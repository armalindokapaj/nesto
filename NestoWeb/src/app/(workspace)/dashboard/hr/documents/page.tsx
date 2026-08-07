import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §Documents — every employee-linked DocumentFile (CV/certifications/work
// contracts), reusing the same model the Employee Profile already uses;
// PRIVATE_HR-visibility documents are only shown here to HR/FULL, matching
// canViewWorkContract's rule elsewhere.
export default async function HrDocumentsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const canSeePrivate = can(role, "HR", "FULL");

  const documents = await db.documentFile.findMany({
    where: { tenantId, employeeId: { not: null }, ...(canSeePrivate ? {} : { visibility: "COMPANY" }) },
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: { id: "desc" },
    take: 100,
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.documents")}</CardTitle><CardDescription>{t("hrDashboard.documentsSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("dashboards.hr.employees")}</TH><TH>{t("hrDashboard.visibility")}</TH><TH>{t("dashboards.admin.joined")}</TH></TRow></THead>
            <TBody>
              {documents.map((d) => (
                <TRow key={d.id}>
                  <TD className="font-medium text-ink">{d.name}</TD>
                  <TD className="text-ink-muted">{d.employee?.fullName ?? "—"}</TD>
                  <TD><Badge tone={d.visibility === "PRIVATE_HR" ? "warning" : "neutral"}>{d.visibility}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(d.createdAt)}</TD>
                </TRow>
              ))}
              {documents.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
