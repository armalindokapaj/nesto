"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createJournalEntryAction } from "@/app/actions/finance-module";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

type Line = { accountId: string; debit: string; credit: string };

// §8 — a journal may be saved as an unbalanced Draft (useful while building
// it up); only posting enforces "total debits equal total credits", so this
// form shows the running balance as a live hint, not a submit-blocker.
export function JournalEntryForm({
  periods,
  accounts,
}: {
  periods: { id: string; name: string }[];
  accounts: { id: string; code: string; name: string }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createJournalEntryAction(undefined, {
        periodId,
        description,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({ accountId: l.accountId, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })),
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/finance/journal");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="je-period">{t("financeModule.fiscalPeriod")}</Label>
          <select
            id="je-period"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="je-description">{t("common.description")}</Label>
          <Textarea id="je-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={1} />
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={line.accountId}
              onChange={(e) => updateLine(i, { accountId: e.target.value })}
              className="h-9 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">{t("financeModule.selectAccount")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("financeModule.debit")}
              value={line.debit}
              onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
              className="w-28"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("financeModule.credit")}
              value={line.credit}
              onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
              className="w-28"
            />
            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={lines.length <= 2}
              className="shrink-0 text-ink-faint hover:text-danger disabled:opacity-30"
              aria-label={t("common.remove")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }])}
        >
          <Plus size={13} /> {t("financeModule.addLine")}
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2 text-sm">
        <span className="text-ink-muted">
          {t("financeModule.debit")}: {totalDebit.toFixed(2)} · {t("financeModule.credit")}: {totalCredit.toFixed(2)}
        </span>
        <span className={balanced ? "font-medium text-success" : "font-medium text-warning"}>
          {balanced ? t("financeModule.balanced") : t("financeModule.notBalanced")}
        </span>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" disabled={isPending || !periodId} onClick={submit}>
        {isPending ? t("common.creating") : t("common.create")}
      </Button>
    </div>
  );
}
