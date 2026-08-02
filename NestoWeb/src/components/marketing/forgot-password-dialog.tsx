"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, X } from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ForgotPasswordDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);
  const succeeded = state && "success" in state;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="font-medium text-gold hover:underline">
          {t("auth.forgotPassword")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("forgotPassword.title")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>

          {succeeded ? (
            <div className="flex flex-col items-center gap-2.5 py-2 text-center">
              <CheckCircle2 size={28} className="text-success" />
              <p className="text-sm font-medium text-ink">{t("forgotPassword.successTitle")}</p>
              <p className="text-xs leading-relaxed text-ink-muted">{t("forgotPassword.successBody")}</p>
            </div>
          ) : (
            <form action={formAction} className="space-y-3.5">
              <p className="text-xs leading-relaxed text-ink-muted">{t("forgotPassword.body")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">{t("forgotPassword.emailLabel")}</Label>
                <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
              </div>
              {state && "error" in state && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? t("forgotPassword.sending") : t("forgotPassword.submit")}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
