"use client";

import { useActionState, useState } from "react";
import { registerDeviceAction, revokeDeviceAction } from "@/app/actions/mobile-access";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

export function RegisterDeviceForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(registerDeviceAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="deviceLabel">{t("mobileAccess.deviceLabel")}</Label>
        <Input id="deviceLabel" name="deviceLabel" placeholder="e.g. My iPhone" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="platform">{t("mobileAccess.platform")}</Label>
        <select id="platform" name="platform" defaultValue="WEB" className={SELECT_CLASS}>
          {["WEB", "IOS", "ANDROID"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>{pending ? t("common.saving") : t("mobileAccess.registerDevice")}</Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function RevokeDeviceButton({ deviceId }: { deviceId: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await revokeDeviceAction(deviceId);
        setPending(false);
      }}
    >
      {t("mobileAccess.revoke")}
    </Button>
  );
}
