import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listTaxRelatedPage } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";
import { parsePageParams } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";

export default async function TaxManagementPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = parsePageParams(await searchParams);
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const rowsPage = await listTaxRelatedPage(tenantId, params);
  const rows = rowsPage.items;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.taxTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("finance_sub.taxSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TRow key={r.id}>
                  <TD className="whitespace-nowrap text-ink-muted">{formatDate(r.issuedDate)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{r.number}</p>
                    <p className="text-xs text-ink-muted">{r.description}</p>
                  </TD>
                  <TD className="font-medium text-danger">{formatMinor(Math.abs(r.amountMinor), r.currency)}</TD>
                  <TD>
                    <Badge status={r.status}>{r.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {rows.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="text-center text-ink-faint py-8">
                    {t("common.noResults")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
          <Pagination page={rowsPage.page} pageCount={rowsPage.pageCount} total={rowsPage.total} pageSize={rowsPage.pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
