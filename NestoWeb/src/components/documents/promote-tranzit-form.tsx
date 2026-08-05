"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "lucide-react";
import { promoteFromTranzitAction } from "@/app/actions/documents-module";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

// §18 — a controlled move out of the draft workspace into an official
// folder. Tranzit itself is excluded from the destination list server-side.
export function PromoteTranzitForm({
  documentId,
  folders,
}: {
  documentId: string;
  folders: { id: string; name: string; depth: number }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(promoteFromTranzitAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <ArrowUpRight size={14} /> {t("documents.promoteFromTranzit")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("documents.promoteFromTranzit")}</Dialog.Title>
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
            <input type="hidden" name="documentId" value={documentId} />
            <div className="space-y-1.5">
              <Label htmlFor="destinationFolderId">{t("documents.destinationFolder")}</Label>
              <select
                id="destinationFolderId"
                name="destinationFolderId"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="" disabled>
                  {t("documents.destinationFolder")}
                </option>
                {folders
                  .filter((f) => f.name !== "Tranzit")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {" ".repeat(f.depth * 3)}
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="keepShortcut" className="rounded border-border" />
              {t("documents.keepShortcutInTranzit")}
            </label>
            {state && "error" in state && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.creating") : t("documents.promote")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
