"use client";

import { useActionState } from "react";
import { saveTenantSettingsAction } from "@/app/actions/tenant-settings";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

type Settings = { defaultCurrency: string; dateFormat: string; timeFormat: string; calendarDefault: string };

export function TenantSettingsForm({ settings }: { settings: Settings }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(saveTenantSettingsAction, undefined);

  return (
    <form action={formAction} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="defaultCurrency">{t("finance_sub.defaultCurrency")}</Label>
        <Input id="defaultCurrency" name="defaultCurrency" defaultValue={settings.defaultCurrency} maxLength={3} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dateFormat">Date format</Label>
        <select
          id="dateFormat"
          name="dateFormat"
          defaultValue={settings.dateFormat}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timeFormat">Time format</Label>
        <select
          id="timeFormat"
          name="timeFormat"
          defaultValue={settings.timeFormat}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="12H">12-hour</option>
          <option value="24H">24-hour</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendarDefault">Calendar default</Label>
        <select
          id="calendarDefault"
          name="calendarDefault"
          defaultValue={settings.calendarDefault}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="DAY">Day</option>
          <option value="WEEK">Week</option>
          <option value="MONTH">Month</option>
        </select>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      {state?.success && <p className="text-xs text-success">{t("common.save")} ✓</p>}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
