"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, RotateCcw } from "lucide-react";
import { createClientAction } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useDraft } from "@/hooks/use-draft";
import { useI18n } from "@/lib/i18n/locale-provider";

const DRAFT_KEY = "client.create";

// PRD_Platform_UI_UX_Architecture §18 Universal Draft Mode — pilot. Saving
// this draft never creates a Client, allocates anything, or notifies
// anyone; it's purely "don't lose what I typed if I navigate away," which
// is the whole PRD rule (Manual Save vs. business consequence are distinct
// axes). See src/hooks/use-draft.ts for why the pilot is scoped to one form.
export function CreateClientDialog({
  projects,
  defaultOpen,
  defaultClientType,
}: {
  projects: { id: string; name: string }[];
  // PRD_Sales_Dashboard §18 — "Add Client Company" Quick Action opens this
  // same dialog pre-filled, not a second create form.
  defaultOpen?: boolean;
  defaultClientType?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createClientAction, undefined);
  const { showRestoreBanner, draftValues, onFormChange, dismissDraft, onSubmitted } = useDraft(DRAFT_KEY);
  const [restored, setRestored] = useState(false);
  const values = restored ? draftValues : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("clients.newClient")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("clients.newClient")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          {showRestoreBanner && !restored && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink">
              <span>{t("drafts.restorePrompt")}</span>
              <div className="flex gap-1.5 shrink-0">
                <Button type="button" size="sm" variant="secondary" onClick={() => setRestored(true)}><RotateCcw size={12} /> {t("drafts.restore")}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={dismissDraft}>{t("drafts.discard")}</Button>
              </div>
            </div>
          )}
          <form
            key={restored ? "restored" : "fresh"}
            onChange={(e) => onFormChange(e.currentTarget)}
            action={async (formData) => {
              await formAction(formData);
              await onSubmitted();
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            {defaultClientType && <input type="hidden" name="clientType" value={defaultClientType} />}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("clients.name")}</Label>
              <Input id="name" name="name" defaultValue={values?.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactName">{t("clients.contactName")}</Label>
              <Input id="contactName" name="contactName" defaultValue={values?.contactName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" name="email" type="email" defaultValue={values?.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("contractors.contact")}</Label>
              <Input id="phone" name="phone" defaultValue={values?.phone} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projectId">{t("common.project")}</Label>
              <select
                id="projectId"
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
            {state?.error && (
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
