import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listStopWorkOrdersPage, listProjectsForPicker } from "@/server/hse";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IssueStopWorkDialog, ReleaseStopWorkForm } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { parsePageParams } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";
import { getT } from "@/lib/i18n/server";

export default async function StopWorkPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = parsePageParams(await searchParams);
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canIssue = can(role, "HSE_REPORTS", "WRITE");
  const canRelease = can(role, "HSE_REPORTS", "FULL");

  const [ordersPage, projects] = await Promise.all([listStopWorkOrdersPage(tenantId, params), listProjectsForPicker(tenantId)]);
  const orders = ordersPage.items;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.stopWorkTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.stopWorkSubtitle")}</p>
        </div>
        {canIssue && projects.length > 0 && <IssueStopWorkDialog projects={projects} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("hse.scopeType")}</TH>
                <TH>{t("hse.reason")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("hse.issuedBy")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {orders.map((o) => (
                <TRow key={o.id}>
                  <TD className="text-ink-muted">
                    {t(`hse.scopeType_${o.scopeType}`)}
                    {o.scopeRef ? ` · ${o.scopeRef}` : ""}
                  </TD>
                  <TD className="text-ink">{o.reason}</TD>
                  <TD>
                    <Badge tone={o.status === "ACTIVE" ? "danger" : "success"}>
                      {o.status === "ACTIVE" ? t("hse.gateStatus_BLOCKED") : t("hse.release")}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">
                    {o.issuedBy.displayName} · {formatDate(o.issuedAt)}
                  </TD>
                  <TD>{canRelease && o.status === "ACTIVE" && <ReleaseStopWorkForm orderId={o.id} />}</TD>
                </TRow>
              ))}
              {orders.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("hse.noStopWork")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
          <Pagination page={ordersPage.page} pageCount={ordersPage.pageCount} total={ordersPage.total} pageSize={ordersPage.pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
