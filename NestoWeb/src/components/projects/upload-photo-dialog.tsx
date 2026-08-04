"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Upload, X } from "lucide-react";
import { uploadProjectPhotoAction } from "@/app/actions/project-photos";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function UploadPhotoDialog({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(uploadProjectPhotoAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("photoProgress.uploadPhotos")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("photoProgress.uploadPhotos")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form action={formAction} className="space-y-3.5">
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="file"
              name="file"
              accept="image/*"
              required
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-border"
            />
            <div className="space-y-1.5">
              <Label htmlFor="caption">{t("photoProgress.caption")}</Label>
              <Input id="caption" name="caption" placeholder={t("photoProgress.captionPlaceholder")} />
            </div>
            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              <Upload size={14} /> {pending ? t("common.uploading") : t("photoProgress.upload")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
