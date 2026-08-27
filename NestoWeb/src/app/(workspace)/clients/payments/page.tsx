import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listClientPayments } from "@/server/crm-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";

// PRD_Sales_Dashboard §6 — "Payments: Permission-filtered Finance/CRM
// payment summary entry." Finance remains the source of truth for Invoice;
// this is a read-only, FINANCE:READ-gated summary filtered to client-linked
// contracts, never a second payments editor.
export default async function ClientPaymentsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const { t } = await getT();

  if (!can(role, "FINANCE", "READ")) {
    return (
      <div className="space-y-6">
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
          <ArrowLeft size={14} /> {t("clients.title")}
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-faint">{t("dashboards.sales.financeRestricted")}</CardContent>
        </Card>
      </div>
    );
  }

  const payments = await listClientPayments(tenantId);

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.payments")}</CardTitle>
            <CardDescription>{t("dashboards.sales.financialSummaryTitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("nav.contracts")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TRow key={p.id}>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(p.issuedDate)}</TD>
                  <TD className="font-medium text-ink">
                    {p.clientId ? (
                      <Link href={`/clients/${p.clientId}`} className="hover:text-gold hover:underline">
                        {p.clientName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{p.contract?.number ?? "—"}</TD>
                  <TD className="text-ink-muted">{formatMinor(p.amountMinor, p.currency)}</TD>
                  <TD>
                    <Badge status={p.status}>{p.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {payments.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noTransactions")}
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
