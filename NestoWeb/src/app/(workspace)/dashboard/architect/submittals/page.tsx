import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSubmittals } from "@/server/architecture";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

export default async function SubmittalsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const submittals = await listSubmittals(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.submittals")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("dashboards.finance.submitter")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {submittals.map((s) => (
                <TRow key={s.id}>
                  <TD className="font-medium text-ink">{s.number} · {s.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/architect/projects/${s.project.id}/submittals`} className="hover:text-gold hover:underline">
                      {s.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{s.type}</TD>
                  <TD className="text-ink-muted">{s.submitter.displayName}</TD>
                  <TD>
                    <Badge status={s.status}>{s.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {submittals.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.architect.noSubmittals")}
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
