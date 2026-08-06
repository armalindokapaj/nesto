"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createCollectionAction,
  deleteCollectionAction,
  addDocumentToCollectionAction,
  removeDocumentFromCollectionAction,
} from "@/app/actions/documents-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

function DialogShell({ trigger, title, open, onOpenChange, children }: { trigger: React.ReactNode; title: string; open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CreateCollectionDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCollectionAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("documents.newCollection")}</Button>} title={t("documents.newCollection")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="name">{t("documents.collectionName")}</Label><Input id="name" name="name" required /></div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="shared" />
          {t("documents.collectionShared")}
        </label>
        {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function DeleteCollectionButton({ collectionId }: { collectionId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => deleteCollectionAction(collectionId)}>{t("common.delete")}</Button>;
}

export function AddToCollectionForm({ collectionId, documents }: { collectionId: string; documents: { id: string; title: string; code: string }[] }) {
  const { t } = useI18n();
  const [documentId, setDocumentId] = useState("");
  const [state, formAction] = useActionState(addDocumentToCollectionAction, undefined);
  return (
    <form
      action={async (fd) => { await formAction(fd); setDocumentId(""); }}
      className="flex gap-2"
    >
      <input type="hidden" name="collectionId" value={collectionId} />
      <select name="documentId" className={SELECT_CLASS} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
        <option value="" disabled>{t("common.select")}</option>
        {documents.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.title}</option>)}
      </select>
      <Button type="submit" size="sm" disabled={!documentId}>{t("documents.addToCollection")}</Button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function RemoveFromCollectionButton({ itemId, collectionId }: { itemId: string; collectionId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => removeDocumentFromCollectionAction(itemId, collectionId)}>{t("common.remove")}</Button>;
}
