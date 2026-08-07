"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createOpportunityAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

// `clientId` binds the dialog to one client (used from the Client Page).
// `clients` renders a picker instead — used from the standalone Opportunities
// register (PRD_Sales_Dashboard §11), where no single client is in context.
export function CreateOpportunityDialog({
  clientId,
  clients,
  defaultOpen,
}: {
  clientId?: string;
  clients?: { id: string; name: string }[];
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createOpportunityAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("crm.addOpportunity")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("crm.addOpportunity")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            {clientId ? (
              <input type="hidden" name="clientId" value={clientId} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="opp-client">{t("nav.clients")}</Label>
                <select
                  id="opp-client"
                  name="clientId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="" disabled>
                    {t("common.none")}
                  </option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="opp-title">{t("crm.opportunityTitle")}</Label>
              <Input id="opp-title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-value">{t("crm.estimatedValue")}</Label>
              <Input id="opp-value" name="estimatedValue" type="number" min="0" step="0.01" />
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
