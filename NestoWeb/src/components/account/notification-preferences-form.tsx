"use client";

import { useActionState } from "react";
import { saveNotificationPreferencesAction } from "@/app/actions/account";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

type Preference = { category: string; inApp: boolean; email: boolean; whatsapp: boolean };

export function NotificationPreferencesForm({ preferences }: { preferences: Preference[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(saveNotificationPreferencesAction, undefined);

  const byCategory = new Map(preferences.map((p) => [p.category, p]));

  return (
    <form action={formAction} className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="pb-2 font-medium">{t("common.status")}</th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th key={channel} className="pb-2 font-medium text-center">
                  {t(`account.channel_${channel}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_CATEGORIES.map((category) => {
              const pref = byCategory.get(category);
              return (
                <tr key={category} className="border-t border-border">
                  <td className="py-2.5 text-ink">{t(`account.category_${category.toLowerCase()}`)}</td>
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <td key={channel} className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        name={`${category}_${channel}`}
                        defaultChecked={pref ? pref[channel] : channel === "inApp"}
                        className="rounded border-border-strong accent-gold"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state?.success && <p className="text-xs text-success">{t("account.preferencesSaved")}</p>}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
