import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listJournalEntries, listAccounts, listFiscalPeriods, ensureCurrentFiscalPeriod } from "@/server/finance";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { JournalEntryForm } from "@/components/finance/journal-entry-form";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function JournalEntriesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "FINANCE", "WRITE");

  await ensureCurrentFiscalPeriod(tenantId);
  const [entries, accounts, periods] = await Promise.all([listJournalEntries(tenantId), listAccounts(tenantId), listFiscalPeriods(tenantId)]);
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      {canWrite && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("financeModule.newJournalEntry")}</CardTitle>
              <CardDescription>{t("financeModule.journalEntrySubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {openPeriods.length > 0 && accounts.length > 0 ? (
              <JournalEntryForm
                periods={openPeriods.map((p) => ({ id: p.id, name: p.name }))}
                accounts={accounts.filter((a) => a.postingAllowed).map((a) => ({ id: a.id, code: a.code, name: a.name }))}
              />
            ) : (
              <p className="text-sm text-ink-faint">{t("financeModule.needAccountsAndPeriod")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("financeModule.journalEntries")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.journalNumber")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("financeModule.fiscalPeriod")}</TH>
                <TH>{t("financeModule.amount")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {entries.map((entry) => {
                const total = entry.lines.reduce((sum, l) => sum + l.debit, 0);
                return (
                  <TRow key={entry.id}>
                    <TD className="font-mono text-xs font-medium text-ink">
                      <Link href={`/dashboard/finance/journal/${entry.id}`} className="hover:text-gold hover:underline">
                        {entry.number}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{entry.description}</TD>
                    <TD className="text-ink-muted">{entry.period.name}</TD>
                    <TD className="text-ink-muted">{total.toFixed(2)}</TD>
                    <TD>
                      <Badge tone={entry.status === "POSTED" ? "success" : entry.status === "REVERSED" ? "neutral" : "warning"}>
                        {t(`financeModule.journalStatus_${entry.status}`)}
                      </Badge>
                    </TD>
                    <TD className="text-ink-muted">{formatDate(entry.date)}</TD>
                  </TRow>
                );
              })}
              {entries.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("financeModule.noJournalEntries")}
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
