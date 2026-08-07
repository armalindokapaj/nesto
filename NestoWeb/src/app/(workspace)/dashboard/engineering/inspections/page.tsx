import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInspectionRequests } from "@/server/qaqc";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateInspectionRequestDialog } from "@/components/engineering/create-inspection-request-dialog";
import { InspectionActions } from "@/components/engineering/inspection-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Engineer_Dashboard §20 — Inspections, QA/QC-owned. This IS the QA/QC
// module (src/server/qaqc.ts) — Engineering has no second inspection state.
export default async function InspectionsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const [inspections, projects] = await Promise.all([listInspectionRequests(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.inspections")}</CardTitle>
            <CardDescription>{t("dashboards.engineer.technicalStatus")}</CardDescription>
          </div>
          {canWrite && <CreateInspectionRequestDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.engineer.result")}</TH>
                {canWrite && <TH></TH>}
              </TRow>
            </THead>
            <TBody>
              {inspections.map((i) => (
                <TRow key={i.id}>
                  <TD>
                    <p className="font-medium text-ink">{i.number}</p>
                    <p className="text-xs text-ink-muted">{i.inspectionType ?? "—"} · {i.location ?? "—"}</p>
                  </TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${i.project.id}`} className="hover:text-gold hover:underline">
                      {i.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted whitespace-nowrap">{i.plannedDate ? formatDate(i.plannedDate) : "—"}</TD>
                  <TD>
                    <Badge status={i.status}>{i.status.replace("_", " ")}</Badge>
                  </TD>
                  <TD>
                    {i.result ? (
                      <Badge tone={i.result === "FAIL" ? "danger" : i.result === "PASS" ? "success" : "neutral"}>{i.result.replace("_", " ")}</Badge>
                    ) : (
                      "—"
                    )}
                  </TD>
                  {canWrite && (
                    <TD>
                      <InspectionActions id={i.id} status={i.status} />
                    </TD>
                  )}
                </TRow>
              ))}
              {inspections.length === 0 && (
                <TRow>
                  <TD colSpan={canWrite ? 6 : 5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.engineer.noInspections")}
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
