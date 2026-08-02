"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createContractorAction } from "@/app/actions/contractors";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateContractorDialog({ variant = "button" }: { variant?: "button" | "inline" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createContractorAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {variant === "inline" ? (
          <button
            type="button"
            className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-ink-muted hover:border-gold hover:text-gold"
            title={t("contractors.newContractor")}
          >
            <Plus size={13} /> {t("contractors.newContractor")}
          </button>
        ) : (
          <Button size="sm">
            <Plus size={14} /> {t("contractors.newContractor")}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("contractors.newContractor")}</Dialog.Title>
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
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradeType">{t("contractors.trade")}</Label>
              <Input id="tradeType" name="tradeType" placeholder="Electrical, Plumbing…" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("contractors.contact")}</Label>
              <Input id="phone" name="phone" />
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
