"use client";

import { useActionState } from "react";
import { updateEmployeeContactAction } from "@/app/actions/employee-profile";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function EmployeeContactForm({ employeeId, phone }: { employeeId: string; phone: string | null }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateEmployeeContactAction, undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="phone">{t("account.phone")}</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ""} placeholder="+355 6X XXX XXXX" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
      {state?.success && <p className="text-xs text-success self-center">{t("common.save")} ✓</p>}
      {state?.error && <p className="text-xs text-danger self-center">{state.error}</p>}
    </form>
  );
}
