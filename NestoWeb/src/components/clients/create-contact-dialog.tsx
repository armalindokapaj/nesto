"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { addContactAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SuggestInput } from "@/components/ui/suggest-input";
import { CONTACT_ROLE_SUGGESTIONS } from "@/lib/crm-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Sales_Dashboard §6 — standalone Contacts register needs a client
// picker the per-client ContactManager form doesn't (clientId is already
// fixed there).
export function CreateContactDialog({ clients, defaultOpen }: { clients: { id: string; name: string }[]; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(addContactAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("crm.addContact")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("crm.addContact")}</Dialog.Title>
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
              <Label htmlFor="contact-client">{t("nav.clients")}</Label>
              <select
                id="contact-client"
                name="clientId"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="" disabled>
                  {t("common.none")}
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">{t("crm.contactName")}</Label>
              <Input id="contact-name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-title">{t("crm.contactTitle")}</Label>
                <Input id="contact-title" name="title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-department">{t("crm.department")}</Label>
                <Input id="contact-department" name="department" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-role">{t("crm.contactRole")}</Label>
              <SuggestInput id="contact-role" name="role" suggestions={CONTACT_ROLE_SUGGESTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">{t("common.email")}</Label>
                <Input id="contact-email" name="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">{t("common.phone")}</Label>
                <Input id="contact-phone" name="phone" />
              </div>
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
