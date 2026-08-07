import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSpecifications } from "@/server/engineering";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateSpecificationDialog } from "@/components/engineering/create-specification-dialog";
import { getT } from "@/lib/i18n/server";

export default async function SpecificationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const [specs, projects] = await Promise.all([listSpecifications(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.specifications")}</CardTitle>
          {canWrite && <CreateSpecificationDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("dashboards.architect.revision")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {specs.map((s) => (
                <TRow key={s.id}>
                  <TD className="font-medium text-ink">{s.code} · {s.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${s.project.id}`} className="hover:text-gold hover:underline">
                      {s.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{s.currentRevision}</TD>
                  <TD>
                    <Badge status={s.status}>{s.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {specs.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("dashboards.engineer.noSpecifications")}
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
