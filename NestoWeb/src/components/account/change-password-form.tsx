"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/account";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);

  return (
    <form action={formAction} className="space-y-3.5 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t("account.currentPassword")}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t("account.newPassword")}</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t("account.confirmPassword")}</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">{t("account.passwordUpdated")}</p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("common.saving") : t("account.changePassword")}
      </Button>
    </form>
  );
}
