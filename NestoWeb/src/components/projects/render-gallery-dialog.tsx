"use client";

import { useActionState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Upload, Star } from "lucide-react";
import { uploadProjectRenderAction, pinProjectRenderAction } from "@/app/actions/project-renders";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Render = { id: string; uploadedBy: { displayName: string } };

// PRD_Rework_1 §6/PROJ-005 — clicking the Project Header's cover image opens
// this gallery; picking (or uploading pinned) a render sets it as both the
// header's cover image and the universal thumbnail everywhere at once.
export function RenderGalleryDialog({
  projectId,
  renders,
  pinnedRenderId,
  canManage,
  children,
}: {
  projectId: string;
  renders: Render[];
  pinnedRenderId: string | null;
  canManage: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(uploadProjectRenderAction, undefined);
  const [pinPending, startPinTransition] = useTransition();

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("projects.renderGallery")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>

          {renders.length === 0 ? (
            <p className="text-sm text-ink-faint mb-4">{t("projects.noRendersYet")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {renders.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={!canManage || pinPending}
                  onClick={() => startPinTransition(() => pinProjectRenderAction(projectId, r.id))}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border-2 disabled:cursor-default",
                    r.id === pinnedRenderId ? "border-gold" : "border-border"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route */}
                  <img src={`/api/project-renders/${r.id}/file`} alt="" className="h-full w-full object-cover" />
                  {r.id === pinnedRenderId && (
                    <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-white">
                      <Star size={11} className="fill-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {canManage && (
            <form action={formAction} className="space-y-3 border-t border-border pt-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="file"
                name="file"
                accept="image/*"
                required
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-border"
              />
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" name="pin" defaultChecked={renders.length === 0} className="rounded border-border-strong accent-gold" />
                {t("projects.pinOnUpload")}
              </label>
              {state?.error && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending} size="sm" className="w-full">
                <Upload size={14} /> {pending ? t("common.uploading") : t("projects.uploadRender")}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
