import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listUnitsDirectory } from "@/server/crm-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6 "Units" sidebar item — a cross-project read-only
// directory. Unit pages/creation/editing stay inside the frozen Projects
// tree (src/app/(workspace)/projects/[id]/units); this queries Unit
// directly rather than reaching into that code, and links back into it.
export default async function UnitsDirectoryPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ") && !can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");

  const units = await listUnitsDirectory(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.unitsTitle")}</CardTitle>
            <CardDescription>{t("crm.unitsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.unitCode")}</TH>
                <TH>{t("crm.project")}</TH>
                <TH>{t("common.type")}</TH>
                <TH>{t("crm.lifecycleStatus")}</TH>
              </TRow>
            </THead>
            <TBody>
              {units.map((u) => (
                <TRow key={u.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/projects/${u.projectId}/units/${u.id}`} className="hover:text-gold hover:underline">
                      {u.displayName ?? u.code}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">
                    <Link href={`/projects/${u.projectId}`} className="hover:text-gold hover:underline">
                      {u.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{u.type}</TD>
                  <TD>
                    <Badge status={u.lifecycleStatus}>{u.lifecycleStatus}</Badge>
                  </TD>
                </TRow>
              ))}
              {units.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("crm.noUnitsYet")}
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
