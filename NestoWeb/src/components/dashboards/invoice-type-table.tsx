import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type InvoiceRow = { id: string; number: string; description: string | null; amount: number; currency: string; status: string; issuedDate: Date; dueDate: Date | null };

/** Shared table body for the Revenue/Expenses/Invoices/Payments Project Finance tabs — same filtered-Invoice-list shape, different `type`. */
export async function InvoiceTypeTable({ rows, emptyKey }: { rows: InvoiceRow[]; emptyKey: string }) {
  const { t } = await getT();
  return (
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
            <TD className="text-ink-muted whitespace-nowrap">{formatDate(r.issuedDate)}</TD>
            <TD>
              <p className="font-medium text-ink">{r.number}</p>
              <p className="text-xs text-ink-muted">{r.description}</p>
            </TD>
            <TD className="text-ink-muted">{formatCurrency(Math.abs(r.amount), r.currency)}</TD>
            <TD>
              <Badge status={r.status}>{r.status}</Badge>
            </TD>
          </TRow>
        ))}
        {rows.length === 0 && (
          <TRow>
            <TD colSpan={4} className="py-8 text-center text-ink-faint">
              {t(emptyKey)}
            </TD>
          </TRow>
        )}
      </TBody>
    </Table>
  );
}
