"use client";

import { useActionState, useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Paperclip } from "lucide-react";
import { createSpendingBillAction } from "@/app/actions/finance-spendings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateSpendingBillDialog({
  companyId,
  projects,
  defaultOpen,
}: {
  companyId: string;
  projects: { id: string; name: string }[];
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createSpendingBillAction, undefined);
  const [evidenceDataUrl, setEvidenceDataUrl] = useState<string | null>(null);
  const [evidenceWaived, setEvidenceWaived] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEvidenceDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("dashboards.finance.newSpendingBill")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("dashboards.finance.newSpendingBill")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="evidenceDataUrl" value={evidenceDataUrl ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="sb-project">{t("nav.projects")}</Label>
              <select
                id="sb-project"
                name="projectId"
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t("common.none")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-category">{t("common.category")}</Label>
              <Input id="sb-category" name="category" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="sb-amount">{t("common.amount")}</Label>
                <Input id="sb-amount" name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sb-currency">{t("common.currency")}</Label>
                <Input id="sb-currency" name="currency" defaultValue="EUR" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-cost-center">{t("dashboards.finance.costCenter")}</Label>
              <Input id="sb-cost-center" name="costCenter" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-description">{t("common.description")}</Label>
              <textarea
                id="sb-description"
                name="description"
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("dashboards.finance.evidence")}</Label>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFileChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={evidenceWaived}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50"
              >
                <Paperclip size={13} /> {evidenceDataUrl ? "✓" : t("dashboards.finance.evidence")}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-ink-muted mt-1.5">
                <input type="checkbox" name="evidenceWaived" checked={evidenceWaived} onChange={(e) => setEvidenceWaived(e.target.checked)} />
                {t("dashboards.finance.evidenceWaive")}
              </label>
            </div>
            {state && "error" in state && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.creating") : t("common.create")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
