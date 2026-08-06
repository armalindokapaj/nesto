"use client";

import { useTransition } from "react";
import { setNotificationPolicyAction } from "@/app/actions/event-centre";
import { useI18n } from "@/lib/i18n/locale-provider";

export function NotificationPolicyToggle({ eventKey, mandatory, inAppEnabled }: { eventKey: string; mandatory: boolean; inAppEnabled: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-4 text-xs">
      <label className="flex items-center gap-1.5 text-ink-muted">
        <input
          type="checkbox"
          checked={inAppEnabled}
          disabled={pending}
          onChange={(e) => startTransition(() => setNotificationPolicyAction(eventKey, mandatory, e.target.checked))}
        />
        {t("eventCentre.inApp")}
      </label>
      <label className="flex items-center gap-1.5 text-ink-muted">
        <input
          type="checkbox"
          checked={mandatory}
          disabled={pending}
          onChange={(e) => startTransition(() => setNotificationPolicyAction(eventKey, e.target.checked, inAppEnabled))}
        />
        {t("eventCentre.mandatory")}
      </label>
    </div>
  );
}
