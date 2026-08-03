import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listInvoicesByType } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/finance/invoice-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function PaymentsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canPost = can(role, "FINANCE", "FULL");

  const payments = await listInvoicesByType(tenantId, "PAYMENT");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.paymentsTitle")}</h1>
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
              {payments.map((p) => (
                <TRow key={p.id}>
                  <TD className="whitespace-nowrap text-ink-muted">{formatDate(p.issuedDate)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{p.number}</p>
                    <p className="text-xs text-ink-muted">{p.description}</p>
                  </TD>
                  <TD className="text-ink-muted">
                    {p.project ? (
                      <Link href={`/projects/${p.project.id}`} className="hover:text-gold hover:underline">
                        {p.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className={p.amount >= 0 ? "font-medium text-success" : "font-medium text-danger"}>
                    {formatCurrency(Math.abs(p.amount), p.currency)}
                  </TD>
                  <TD>
                    <Badge status={p.status}>{p.status}</Badge>
                  </TD>
                  {canPost && (
                    <TD>
                      <InvoiceActions invoiceId={p.id} status={p.status} />
                    </TD>
                  )}
                </TRow>
              ))}
              {payments.length === 0 && (
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
