"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createComparisonAction } from "@/app/actions/procurement-comparison";
import { Button } from "@/components/ui/button";

export function CreateComparisonDialog({ rfqs }: { rfqs: { id: string; number: string; title: string; quotationCount: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createComparisonAction, undefined);
  const eligible = rfqs.filter((r) => r.quotationCount > 0);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> New Comparison</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">Start Supplier Comparison</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={formAction} className="space-y-3">
            <select name="rfqId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
              <option value="">Select RFQ with quotations</option>
              {eligible.map((r) => <option key={r.id} value={r.id}>{r.number} — {r.title} ({r.quotationCount} quotations)</option>)}
            </select>
            {eligible.length === 0 && <p className="text-xs text-ink-faint">No RFQs with received quotations yet.</p>}
            {state && "error" in state && state.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending || eligible.length === 0} className="w-full">{pending ? "Creating…" : "Create"}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
