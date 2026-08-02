import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listTaxRelated } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function TaxManagementPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const rows = await listTaxRelated(tenantId);
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
                  <TD className="font-medium text-danger">{formatCurrency(Math.abs(r.amount), r.currency)}</TD>
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
        </CardContent>
      </Card>
    </div>
  );
}
