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

export default async function DrawingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const { status } = await searchParams;
  const allDrawings = await listDrawings(tenantId);
  const drawings = status === "pending" ? allDrawings.filter((d) => d.status !== "APPROVED") : allDrawings;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("architect_sub.drawingsTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("architect_sub.drawingsSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.project")}</TH>
                <TH>{t("nav.drawings")}</TH>
                <TH>{t("dashboards.architect.revision")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.architect.updated")}</TH>
              </TRow>
            </THead>
            <TBody>
              {drawings.map((d) => (
                <TRow key={d.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/projects/${d.project.id}`} className="hover:text-gold hover:underline">
                      {d.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{d.packageName}</TD>
                  <TD className="text-ink-muted">{d.revisionCode}</TD>
                  <TD>
                    <Badge status={d.status}>{d.status.replace("_", " ")}</Badge>
                  </TD>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(d.updatedAt)}</TD>
                </TRow>
              ))}
              {drawings.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("dashboards.architect.noPackages")}
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
