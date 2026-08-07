import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §4 "General Ledger" — the posted FinancialLedgerEntry stream (immutable,
// reversal-linked), distinct from Journal Entries (the pre-posting drafts).
export default async function GeneralLedgerPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const entries = await db.financialLedgerEntry.findMany({
    where: { tenantId },
    orderBy: { postedAt: "desc" },
    take: 200,
    include: { invoice: { select: { number: true, description: true } }, postedBy: { select: { displayName: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.generalLedgerTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("crm.owner")}</TH>
              </TRow>
            </THead>
            <TBody>
              {entries.map((e) => (
                <TRow key={e.id}>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(e.postedAt)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{e.invoice.number}</p>
                    <p className="text-xs text-ink-muted">{e.invoice.description}{e.reversesEntryId ? " (reversal)" : ""}</p>
                  </TD>
                  <TD className="text-ink-muted">{formatCurrency(e.amount, e.currency)}</TD>
                  <TD className="text-ink-muted">{e.postedBy.displayName}</TD>
                </TRow>
              ))}
              {entries.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    —
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
