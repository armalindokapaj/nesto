import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listCalculations } from "@/server/engineering";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCalculationDialog } from "@/components/engineering/create-calculation-dialog";
import { getT } from "@/lib/i18n/server";

export default async function CalculationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const [calcs, projects] = await Promise.all([listCalculations(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.calculations")}</CardTitle>
          {canWrite && <CreateCalculationDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("crm.owner")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {calcs.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-medium text-ink">{c.code} · {c.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${c.project.id}`} className="hover:text-gold hover:underline">
                      {c.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{c.author?.displayName ?? "—"}</TD>
                  <TD>
                    <Badge status={c.status}>{c.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {calcs.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("dashboards.engineer.noCalculations")}
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
