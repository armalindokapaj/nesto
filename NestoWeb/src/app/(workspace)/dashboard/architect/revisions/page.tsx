import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listDrawings } from "@/server/architecture";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function RevisionsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const drawings = await listDrawings(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("architect_sub.revisionsTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("architect_sub.revisionsSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("dashboards.architect.revision")}</TH>
                <TH>{t("nav.drawings")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("common.type")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.architect.updated")}</TH>
              </TRow>
            </THead>
            <TBody>
              {drawings.map((d) => (
                <TRow key={d.id}>
                  <TD className="font-medium text-ink">{d.revisionCode}</TD>
                  <TD className="text-ink-muted">{d.packageName}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/projects/${d.project.id}`} className="hover:text-gold hover:underline">
                      {d.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{d.discipline ?? "—"}</TD>
                  <TD>
                    <Badge status={d.status}>{d.status.replace("_", " ")}</Badge>
                  </TD>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(d.updatedAt)}</TD>
                </TRow>
              ))}
              {drawings.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="text-center text-ink-faint py-8">
                    {t("common.noResults")}
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
