import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInvoicesByTypePage } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";
import { parsePageParams } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = parsePageParams(await searchParams);
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const billsPage = await listInvoicesByTypePage(tenantId, "BILL", params);
  const bills = billsPage.items;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.billsTitle")}</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {bills.map((bill) => (
                <TRow key={bill.id}>
                  <TD className="whitespace-nowrap text-ink-muted">{formatDate(bill.issuedDate)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{bill.number}</p>
                    <p className="text-xs text-ink-muted">{bill.description}</p>
                  </TD>
                  <TD className="text-ink-muted">
                    {bill.project ? (
                      <Link href={`/projects/${bill.project.id}`} className="hover:text-gold hover:underline">
                        {bill.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="font-medium text-danger">{formatMinor(Math.abs(bill.amountMinor), bill.currency)}</TD>
                  <TD>
                    <Badge status={bill.status}>{bill.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {bills.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("common.noResults")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
          <Pagination page={billsPage.page} pageCount={billsPage.pageCount} total={billsPage.total} pageSize={billsPage.pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
