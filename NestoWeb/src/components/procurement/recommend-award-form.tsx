"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { recommendAwardAction } from "@/app/actions/procurement-comparison";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RecommendAwardForm({ comparisonId, quotations }: { comparisonId: string; quotations: { id: string; supplierName: string; total: number; currency: string }[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recommendAwardAction, undefined);
  const [selected, setSelected] = useState(quotations[0]?.id ?? "");

  useEffect(() => {
    if (state && "success" in state && state.success) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="comparisonId" value={comparisonId} />
      <p className="text-sm font-medium text-ink">Recommend Award</p>
      <select name="recommendedQuotationId" value={selected} onChange={(e) => setSelected(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
        {quotations.map((q) => <option key={q.id} value={q.id}>{q.supplierName} — {q.total} {q.currency}</option>)}
      </select>
      <Input name="justification" placeholder="Justification" />
      {state && "error" in state && state.error && <p className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Submitting…" : "Recommend Award"}</Button>
    </form>
  );
}
