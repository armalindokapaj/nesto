import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §14.3 Unit Finance, company-wide — sale/rental relationships across
// every project. Unit availability/pricing stays owned by Unit; this reads
// ClientUnitRelationship (CRM-owned) for the money side.
export default async function UnitFinancePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const relationships = await db.clientUnitRelationship.findMany({
    where: { tenantId, type: { in: ["RESERVED", "PURCHASED", "RENTED"] } },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, unit: { select: { id: true, code: true, projectId: true, project: { select: { name: true } } } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.unitFinanceTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.unit")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.finalPrice")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {relationships.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/projects/${r.unit.projectId}/units/${r.unit.id}`} className="hover:text-gold hover:underline">
                      {r.unit.code}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{r.unit.project.name}</TD>
                  <TD className="text-ink-muted">{r.client.name}</TD>
                  <TD className="text-ink-muted">{r.finalPrice != null ? formatCurrency(r.finalPrice) : "—"}</TD>
                  <TD>
                    <Badge tone="info">{r.type}</Badge>
                  </TD>
                </TRow>
              ))}
              {relationships.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    —
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
