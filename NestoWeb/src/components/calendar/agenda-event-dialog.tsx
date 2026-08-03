"use client";

import { useActionState, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Trash2 } from "lucide-react";
import { createAgendaEventAction, updateAgendaEventAction, deleteAgendaEventAction } from "@/app/actions/calendar";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type AgendaEventLike = {
  id: string;
  title: string;
  startAt: string | Date;
  endAt?: string | Date | null;
  location?: string | null;
  notes?: string | null;
};

// PRD_9 §3.1 — the "Personal agenda" calendar item type has no other
// source-of-truth page to deep-link to (Calendar IS its home), so this
// dialog doubles as both the add form and the "click behavior" for existing
// agenda chips (edit + delete inline instead of navigating elsewhere).
export function AgendaEventDialog({
  event,
  defaultDate,
  triggerVariant = "button",
}: {
  event?: AgendaEventLike;
  defaultDate?: Date;
  triggerVariant?: "button" | "icon" | "chip";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(event);
  const [state, formAction, pending] = useActionState(isEdit ? updateAgendaEventAction : createAgendaEventAction, undefined);
  const [, startTransition] = useTransition();

  const defaultAt = defaultDate ?? new Date();
  if (!defaultDate) defaultAt.setHours(9, 0, 0, 0);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {triggerVariant === "icon" ? (
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-gold"
            aria-label={t("calendar.addAgendaEvent")}
          >
            <Plus size={11} />
          </button>
        ) : triggerVariant === "chip" ? (
          <button
            type="button"
            className="w-full truncate rounded px-1 py-0.5 text-left text-[0.65rem] font-medium bg-surface-sunken text-ink-muted hover:bg-border-strong"
          >
            {event!.title}
          </button>
        ) : (
          <Button size="sm">
            <Plus size={14} /> {t("calendar.addAgendaEvent")}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">
              {isEdit ? t("calendar.editAgendaEvent") : t("calendar.addAgendaEvent")}
            </Dialog.Title>
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
            {isEdit && <input type="hidden" name="id" value={event!.id} />}
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("calendar.eventTitle")}</Label>
              <Input id="title" name="title" required defaultValue={event?.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startAt">{t("calendar.startAt")}</Label>
              <Input
                id="startAt"
                name="startAt"
                type="datetime-local"
                required
                defaultValue={toLocalDateTimeInput(event ? new Date(event.startAt) : defaultAt)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endAt">{t("calendar.endAt")}</Label>
              <Input
                id="endAt"
                name="endAt"
                type="datetime-local"
                defaultValue={event?.endAt ? toLocalDateTimeInput(new Date(event.endAt)) : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">{t("calendar.location")}</Label>
              <Input id="location" name="location" defaultValue={event?.location ?? undefined} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("hr_sub.notes")}</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={event?.notes ?? undefined} />
            </div>

            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
              </Button>
              {isEdit && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      deleteAgendaEventAction(event!.id);
                      setOpen(false);
                    })
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                  aria-label={t("common.delete")}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
