"use client";

import { useTransition } from "react";
import { updatePlanNameAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function UpdatePlanForm({ planName }: { planName: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updatePlanNameAction(formData))}
      className="flex items-end gap-3 max-w-sm"
    >
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="planName">{t("admin_sub.planName")}</Label>
        <Input id="planName" name="planName" defaultValue={planName} required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? t("common.saving") : t("admin_sub.savePlan")}
      </Button>
    </form>
  );
}
