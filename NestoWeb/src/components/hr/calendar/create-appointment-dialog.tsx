"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createAppointmentAction } from "@/app/actions/hr-calendar";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Props = {
  defaultDate?: Date;
  triggerVariant?: "button" | "icon";
};

export function CreateAppointmentDialog({ defaultDate, triggerVariant = "button" }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("INTERVIEW");
  const [state, formAction, pending] = useActionState(createAppointmentAction, undefined);

  const defaultAt = defaultDate ?? new Date();
  if (!defaultDate) defaultAt.setHours(9, 0, 0, 0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setType("INTERVIEW");
      }}
    >
      <Dialog.Trigger asChild>
        {triggerVariant === "icon" ? (
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-gold"
            aria-label={t("hr_sub.newAppointment")}
          >
            <Plus size={13} />
          </button>
        ) : (
          <Button size="sm">
            <Plus size={14} /> {t("hr_sub.newAppointment")}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("hr_sub.newAppointment")}</Dialog.Title>
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
              <Label htmlFor="title">{t("task.title")}</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("hr_sub.appointmentType")}</Label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="INTERVIEW">{t("hr_sub.typeInterview")}</option>
                <option value="INTERNAL">{t("hr_sub.typeInternal")}</option>
                <option value="OTHER">{t("hr_sub.typeOther")}</option>
              </select>
            </div>
            {type === "INTERVIEW" && (
              <div className="space-y-1.5">
                <Label htmlFor="candidateName">{t("hr_sub.candidateName")}</Label>
                <Input id="candidateName" name="candidateName" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">{t("meetings.scheduled")}</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={toLocalDateTimeInput(defaultAt)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("hr_sub.notes")}</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            {state?.error && (
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
