"use client";

import { useActionState } from "react";
import { setQuietHoursAction, setDigestRuleAction } from "@/app/actions/event-centre";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type QuietHours = { timezone: string; startTime: string; endTime: string; enabled: boolean } | null;
type DigestRule = { frequency: string; timeOfDay: string } | null;

export function QuietHoursForm({ quietHours }: { quietHours: QuietHours }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setQuietHoursAction, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="enabled" defaultChecked={quietHours?.enabled ?? false} />
        {t("account.quietHoursEnable")}
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label htmlFor="timezone">{t("account.timezone")}</Label><Input id="timezone" name="timezone" defaultValue={quietHours?.timezone ?? "UTC"} placeholder="Europe/Tirane" /></div>
        <div className="space-y-1"><Label htmlFor="startTime">{t("account.quietStart")}</Label><Input id="startTime" name="startTime" type="time" defaultValue={quietHours?.startTime ?? "22:00"} /></div>
        <div className="space-y-1"><Label htmlFor="endTime">{t("account.quietEnd")}</Label><Input id="endTime" name="endTime" type="time" defaultValue={quietHours?.endTime ?? "07:00"} /></div>
      </div>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
    </form>
  );
}

export function DigestRuleForm({ digestRule }: { digestRule: DigestRule }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setDigestRuleAction, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="frequency">{t("account.digestFrequency")}</Label>
          <select id="frequency" name="frequency" defaultValue={digestRule?.frequency ?? "OFF"} className={SELECT_CLASS}>
            {["OFF", "DAILY", "WEEKLY"].map((v) => <option key={v} value={v}>{t(`account.digestFrequency_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label htmlFor="timeOfDay">{t("account.digestTime")}</Label><Input id="timeOfDay" name="timeOfDay" type="time" defaultValue={digestRule?.timeOfDay ?? "08:00"} /></div>
      </div>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
    </form>
  );
}
