import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInvoicesByType } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/finance/invoice-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";

export default async function InvoicesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canPost = can(role, "FINANCE", "FULL");

  const invoices = await listInvoicesByType(tenantId, "INVOICE");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.invoicesTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("nav.invoices")}</p>
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
                {canPost && <TH>{t("common.actions")}</TH>}
              </TRow>
            </THead>
            <TBody>
              {invoices.map((inv) => (
                <TRow key={inv.id}>
                  <TD className="whitespace-nowrap text-ink-muted">{formatDate(inv.issuedDate)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{inv.number}</p>
                    <p className="text-xs text-ink-muted">{inv.description}</p>
                  </TD>
                  <TD className="text-ink-muted">
                    {inv.project ? (
                      <Link href={`/projects/${inv.project.id}`} className="hover:text-gold hover:underline">
                        {inv.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="font-medium text-success">{formatMinor(inv.amountMinor, inv.currency)}</TD>
                  <TD>
                    <Badge status={inv.status}>{inv.status}</Badge>
                  </TD>
                  {canPost && (
                    <TD>
                      <InvoiceActions invoiceId={inv.id} status={inv.status} />
                    </TD>
                  )}
                </TRow>
              ))}
              {invoices.length === 0 && (
                <TRow>
                  <TD colSpan={canPost ? 6 : 5} className="text-center text-ink-faint py-8">
                    {t("common.noResults")}
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
