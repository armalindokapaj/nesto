import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listEngineeringPackages } from "@/server/engineering";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateEngineeringPackageDialog } from "@/components/engineering/create-engineering-package-dialog";
import { getT } from "@/lib/i18n/server";

export default async function EngineeringPackagesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const [packages, projects] = await Promise.all([listEngineeringPackages(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.engineeringPackages")}</CardTitle>
            <CardDescription>{t("dashboards.finance.tabOverview")}</CardDescription>
          </div>
          {canWrite && <CreateEngineeringPackageDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {packages.map((p) => (
                <TRow key={p.id}>
                  <TD className="font-medium text-ink">{p.code} · {p.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${p.project.id}`} className="hover:text-gold hover:underline">
                      {p.project.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge status={p.status}>{p.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {packages.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-8 text-center text-ink-faint">
                    {t("dashboards.engineer.noPackages")}
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
