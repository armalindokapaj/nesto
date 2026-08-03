"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X } from "lucide-react";
import { uploadDocumentRevisionAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function UploadRevisionForm({ documentId }: { documentId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(uploadDocumentRevisionAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Upload size={14} /> {t("documents.uploadRevision")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("documents.uploadRevision")}</Dialog.Title>
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
            <input type="hidden" name="supersedesId" value={documentId} />
            <div className="space-y-1.5">
              <Label htmlFor="revision-file">{t("documents.file")}</Label>
              <input
                id="revision-file"
                name="file"
                type="file"
                required
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revisionComment">{t("documents.revisionComment")}</Label>
              <Textarea id="revisionComment" name="revisionComment" rows={3} required />
            </div>
            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.creating") : t("documents.uploadRevision")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
