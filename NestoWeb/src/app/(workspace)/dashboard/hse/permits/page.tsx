import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPermitsToWorkPage, listProjectsForPicker } from "@/server/hse";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RequestPermitToWorkDialog } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { parsePageParams } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";
import { getT } from "@/lib/i18n/server";

export default async function PermitsToWorkPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = parsePageParams(await searchParams);
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [permitsPage, projects] = await Promise.all([listPermitsToWorkPage(tenantId, params), listProjectsForPicker(tenantId)]);
  const permits = permitsPage.items;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.permitsToWorkTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.permitsToWorkSubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <RequestPermitToWorkDialog projects={projects} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.permitType")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hse.issuedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {permits.map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <Link href={`/dashboard/hse/permits/${p.id}`} className="font-medium text-ink hover:text-gold">
                      {t(`hse.permitTypeToWork_${p.permitType}`)}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={p.status === "ACTIVE" ? "success" : p.status === "SUSPENDED" ? "warning" : "neutral"}>
                      {t(`hse.permitToWorkStatus_${p.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{p.issuedBy?.displayName ?? "—"}</TD>
                  <TD className="text-ink-muted">{formatDate(p.createdAt)}</TD>
                </TRow>
              ))}
              {permits.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("hse.noPermitsToWork")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
          <Pagination page={permitsPage.page} pageCount={permitsPage.pageCount} total={permitsPage.total} pageSize={permitsPage.pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
