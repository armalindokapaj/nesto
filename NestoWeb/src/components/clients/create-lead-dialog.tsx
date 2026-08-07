"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createLeadAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SuggestInput } from "@/components/ui/suggest-input";
import { LEAD_SOURCE_SUGGESTIONS } from "@/lib/crm-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateLeadDialog({ defaultOpen }: { defaultOpen?: boolean } = {}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createLeadAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("crm.newLead")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("crm.newLead")}</Dialog.Title>
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
            <div className="space-y-1.5">
              <Label htmlFor="lead-title">{t("crm.leadTitle")}</Label>
              <Input id="lead-title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-person">{t("crm.personName")}</Label>
              <Input id="lead-person" name="personName" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">{t("common.email")}</Label>
                <Input id="lead-email" name="personEmail" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">{t("common.phone")}</Label>
                <Input id="lead-phone" name="personPhone" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">{t("crm.source")}</Label>
              <SuggestInput id="lead-source" name="source" suggestions={LEAD_SOURCE_SUGGESTIONS} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">{t("crm.estimatedValue")}</Label>
              <Input id="lead-value" name="estimatedValue" type="number" min="0" step="0.01" />
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
