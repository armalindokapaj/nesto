import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { requireTenantProject } from "@/lib/tenant";
import { getProjectHeaderInfo } from "@/server/finance-dashboard";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectFinanceTabHeader } from "@/components/dashboards/project-finance-tab-header";
import { getT } from "@/lib/i18n/server";

// §10/§14.3 Unit Finance — reads Unit (owned by the frozen Projects tree,
// read-only here) joined with this project's client-unit sale relationships
// (ClientUnitRelationship, owned by CRM) for reservation/sale amounts.
export default async function ProjectUnitsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  await requireTenantProject(tenantId, id);
  const project = await getProjectHeaderInfo(tenantId, id);
  const units = await db.unit.findMany({ where: { tenantId, projectId: id, archivedAt: null }, orderBy: { code: "asc" } });
  const relationships = await db.clientUnitRelationship.findMany({
    where: { tenantId, unitId: { in: units.map((u) => u.id) }, type: { in: ["RESERVED", "PURCHASED", "RENTED"] } },
    include: { client: { select: { name: true } } },
  });
  const { t } = await getT();
  const relByUnit = new Map(relationships.map((r) => [r.unitId, r]));

  return (
    <div className="space-y-6">
      <ProjectFinanceTabHeader projectId={id} projectName={project.name} projectStatus={project.status} active="units" />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.tabUnits")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.unit")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {units.map((u) => {
                const rel = relByUnit.get(u.id);
                return (
                  <TRow key={u.id}>
                    <TD className="font-medium text-ink">{u.displayName ?? u.code}</TD>
                    <TD className="text-ink-muted">{rel?.client.name ?? "—"}</TD>
                    <TD>
                      <Badge status={u.lifecycleStatus}>{u.lifecycleStatus}</Badge>
                    </TD>
                  </TRow>
                );
              })}
              {units.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-8 text-center text-ink-faint">
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
