import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getJournalEntryDetail } from "@/server/finance-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { JournalEntryActions } from "@/components/finance/journal-entry-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "FINANCE", "FULL");

  const entry = await getJournalEntryDetail(tenantId, id);
  const { t } = await getT();

  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/finance/journal" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("financeModule.journalEntries")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-mono text-base">{entry.number}</CardTitle>
              <Badge tone={entry.status === "POSTED" ? "success" : entry.status === "REVERSED" ? "neutral" : "warning"}>
                {t(`financeModule.journalStatus_${entry.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {entry.description} · {entry.period.name} · {formatDate(entry.date)}
              {entry.reversesEntry && (
                <>
                  {" · "}
                  {t("financeModule.reversalOf")}{" "}
                  <Link href={`/dashboard/finance/journal/${entry.reversesEntry.id}`} className="hover:text-gold hover:underline">
                    {entry.reversesEntry.number}
                  </Link>
                </>
              )}
              {entry.reversedBy && (
                <>
                  {" · "}
                  {t("financeModule.reversedBy")}{" "}
                  <Link href={`/dashboard/finance/journal/${entry.reversedBy.id}`} className="hover:text-gold hover:underline">
                    {entry.reversedBy.number}
                  </Link>
                </>
              )}
            </CardDescription>
          </div>
          {canManage && <JournalEntryActions journalEntryId={entry.id} status={entry.status} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.accountCode")}</TH>
                <TH>{t("financeModule.costCenters")}</TH>
                <TH className="text-right">{t("financeModule.debit")}</TH>
                <TH className="text-right">{t("financeModule.credit")}</TH>
              </TRow>
            </THead>
            <TBody>
              {entry.lines.map((line) => (
                <TRow key={line.id}>
                  <TD className="text-ink">
                    <span className="font-mono text-xs">{line.account.code}</span> {line.account.name}
                  </TD>
                  <TD className="text-ink-muted">{line.costCenter?.name ?? "—"}</TD>
                  <TD className="text-right text-ink-muted">{line.debit > 0 ? line.debit.toFixed(2) : ""}</TD>
                  <TD className="text-right text-ink-muted">{line.credit > 0 ? line.credit.toFixed(2) : ""}</TD>
                </TRow>
              ))}
              <TRow>
                <TD colSpan={2} className="text-right font-medium text-ink">
                  {t("financeModule.total")}
                </TD>
                <TD className="text-right font-medium text-ink">{totalDebit.toFixed(2)}</TD>
                <TD className="text-right font-medium text-ink">{totalCredit.toFixed(2)}</TD>
              </TRow>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {entry.activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              {entry.activity.map((event) => (
                <li key={event.id} className="flex items-start gap-2">
                  {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{event.summary}</p>
                    <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
