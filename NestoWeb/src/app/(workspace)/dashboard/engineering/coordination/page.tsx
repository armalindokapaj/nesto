import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listCoordinationIssues } from "@/server/engineering";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCoordinationIssueDialog } from "@/components/engineering/create-coordination-issue-dialog";
import { CoordinationStatusSelect } from "@/components/engineering/coordination-status-select";
import { getT } from "@/lib/i18n/server";

// PRD_Engineer_Dashboard §21 — Coordination. BIM owns the issue/viewpoint;
// this is the Engineering-side worklist over the same CoordinationIssue
// records (not a duplicate).
export default async function CoordinationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const [issues, projects] = await Promise.all([listCoordinationIssues(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.coordination")}</CardTitle>
          {canWrite && <CreateCoordinationIssueDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {issues.map((i) => (
                <TRow key={i.id}>
                  <TD className="font-medium text-ink">{i.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${i.project.id}`} className="hover:text-gold hover:underline">
                      {i.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{i.priority}</TD>
                  <TD>{canWrite ? <CoordinationStatusSelect id={i.id} status={i.status} /> : <Badge status={i.status}>{i.status}</Badge>}</TD>
                </TRow>
              ))}
              {issues.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("dashboards.engineer.noCoordinationIssues")}
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
