import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listRfis } from "@/server/architecture";
import { listProjects } from "@/server/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateRfiDialog } from "@/components/architecture/create-rfi-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function RfisPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "TASKS", "WRITE");

  const { status } = await searchParams;
  const [allRfis, projects] = await Promise.all([listRfis(tenantId), canCreate ? listProjects(tenantId) : Promise.resolve([])]);
  const rfis = status === "open" ? allRfis.filter((r) => r.status === "OPEN" || r.status === "OVERDUE") : allRfis;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("architect_sub.rfisTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("architect_sub.rfisSubtitle")}</p>
        </div>
        {canCreate && <CreateRfiDialog projects={projects} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>Code</TH>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("contracts.endDate")}</TH>
              </TRow>
            </THead>
            <TBody>
              {rfis.map((rfi) => (
                <TRow key={rfi.id}>
                  <TD className="font-medium text-ink">{rfi.code}</TD>
                  <TD className="text-ink-muted">{rfi.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/projects/${rfi.project.id}`} className="hover:text-gold hover:underline">
                      {rfi.project.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge status={rfi.status}>{rfi.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{rfi.dueDate ? formatDate(rfi.dueDate) : "—"}</TD>
                </TRow>
              ))}
              {rfis.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("dashboards.architect.noRfis")}
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
