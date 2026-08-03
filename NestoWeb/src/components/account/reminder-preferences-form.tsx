"use client";

import { useActionState } from "react";
import { saveReminderPreferencesAction } from "@/app/actions/calendar";
import { REMINDER_ITEM_TYPES, REMINDER_MINUTES_OPTIONS } from "@/lib/constants";
import type { ReminderItemType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_9 §5.1/REM-001 — each user's own reminder lead time, per item type.
export function ReminderPreferencesForm({ preferences }: { preferences: Record<ReminderItemType, number> }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(saveReminderPreferencesAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {REMINDER_ITEM_TYPES.map((itemType) => (
          <div key={itemType} className="space-y-1.5">
            <label htmlFor={`reminder-${itemType}`} className="text-sm text-ink">
              {t(`account.reminder_${itemType}`)}
            </label>
            <select
              id={`reminder-${itemType}`}
              name={itemType}
              defaultValue={preferences[itemType]}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {REMINDER_MINUTES_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t(`account.reminderMinutes_${minutes}`)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {state?.success && <p className="text-xs text-success">{t("account.preferencesSaved")}</p>}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
