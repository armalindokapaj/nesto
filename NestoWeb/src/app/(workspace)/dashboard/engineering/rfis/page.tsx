import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listRfis } from "@/server/architecture";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RespondToRfiForm } from "@/components/architecture/respond-to-rfi-form";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Engineer_Dashboard §18 — same source RFI query as Architecture (§18
// "Dashboard Open RFIs cue and Project RFIs tab must reconcile to the same
// source query definition") — one RFI register, filtered per role's scope.
export default async function EngineeringRfisPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");
  const rfis = await listRfis(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.rfis")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.dueDate")}</TH>
                <TH>{t("common.status")}</TH>
                {canWrite && <TH></TH>}
              </TRow>
            </THead>
            <TBody>
              {rfis.map((r) => (
                <TRow key={r.id}>
                  <TD>
                    <p className="font-medium text-ink">{r.code} · {r.title}</p>
                    {r.response && <p className="text-xs text-ink-muted">{r.response}</p>}
                  </TD>
                  <TD className="text-ink-muted">
                    <Link href={`/projects/${r.project.id}`} className="hover:text-gold hover:underline">
                      {r.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : "—"}</TD>
                  <TD>
                    <Badge status={r.status}>{r.status}</Badge>
                  </TD>
                  {canWrite && <TD>{r.status !== "ANSWERED" && <RespondToRfiForm rfiId={r.id} />}</TD>}
                </TRow>
              ))}
              {rfis.length === 0 && (
                <TRow>
                  <TD colSpan={canWrite ? 5 : 4} className="py-8 text-center text-ink-faint">
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
