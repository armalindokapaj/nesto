"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordComparisonScoreAction, completeComparisonAction } from "@/app/actions/procurement-comparison";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CRITERIA = ["PRICE", "LEAD_TIME", "COMPLIANCE", "QUALITY", "HSE", "WARRANTY", "PERFORMANCE", "RISK"] as const;

type Quotation = { id: string; supplierId: string; supplierName: string; total: number; currency: string; leadTimeDays: number | null };
type ExistingScore = { quotationId: string; criterion: string; score: number };

// §10.1 Comparison workspace — one column per supplier/quotation, one row
// per fixed criterion, normalized total at the bottom.
export function ComparisonScoreGrid({
  comparisonId,
  status,
  quotations,
  existingScores,
  canComplete,
}: {
  comparisonId: string;
  status: string;
  quotations: Quotation[];
  existingScores: ExistingScore[];
  canComplete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editable = status !== "COMPLETED";

  const scoreMap = new Map(existingScores.map((s) => [`${s.quotationId}::${s.criterion}`, s.score]));
  const totals = new Map<string, number>();
  for (const s of existingScores) totals.set(s.quotationId, (totals.get(s.quotationId) ?? 0) + (s.score * (100 / CRITERIA.length)) / 100);

  function setScore(quotationId: string, criterion: string, value: string) {
    const score = parseFloat(value);
    if (Number.isNaN(score)) return;
    setError(null);
    startTransition(async () => {
      try {
        await recordComparisonScoreAction(comparisonId, quotationId, criterion as (typeof CRITERIA)[number], score);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save score.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken">
              <th className="p-2 text-left text-xs font-medium text-ink-faint">Criterion</th>
              {quotations.map((q) => (
                <th key={q.id} className="p-2 text-left text-xs font-medium text-ink-faint">
                  {q.supplierName}
                  <div className="text-[0.65rem] font-normal text-ink-faint">{q.total} {q.currency}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c} className="border-b border-border/60">
                <td className="p-2 text-xs text-ink-muted">{c.replaceAll("_", " ")}</td>
                {quotations.map((q) => (
                  <td key={q.id} className="p-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!editable || isPending}
                      defaultValue={scoreMap.get(`${q.id}::${c}`) ?? ""}
                      onBlur={(e) => e.target.value && setScore(q.id, c, e.target.value)}
                      className="w-16"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-surface-sunken font-semibold">
              <td className="p-2 text-xs text-ink">Normalized Total</td>
              {quotations.map((q) => <td key={q.id} className="p-2 text-ink">{(totals.get(q.id) ?? 0).toFixed(1)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {editable && canComplete && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await completeComparisonAction(comparisonId);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not complete comparison.");
              }
            })
          }
        >
          Complete Comparison
        </Button>
      )}
    </div>
  );
}
