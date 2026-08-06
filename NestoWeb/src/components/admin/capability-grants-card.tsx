"use client";

import { useActionState, useState } from "react";
import { grantCapabilityAction, revokeCapabilityAction } from "@/app/actions/capabilities";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { CAPABILITY_KEYS, CAPABILITY_LABELS } from "@/lib/capabilities";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type PickerUser = { id: string; displayName: string };
type Grant = { id: string; userId: string; capabilityKey: string; revokedAt: Date | null; user: { displayName: string }; grantedBy: { displayName: string } };

export function CapabilityGrantsCard({ users, grants }: { users: PickerUser[]; grants: Grant[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(grantCapabilityAction, undefined);
  const [revoking, setRevoking] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="userId">{t("common.name")}</Label>
          <select id="userId" name="userId" className={SELECT_CLASS} defaultValue="" required>
            <option value="" disabled>{t("common.select")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capabilityKey">{t("admin_sub.capabilityKey")}</Label>
          <select id="capabilityKey" name="capabilityKey" className={SELECT_CLASS} defaultValue={CAPABILITY_KEYS[0]}>
            {CAPABILITY_KEYS.map((k) => <option key={k} value={k}>{CAPABILITY_LABELS[k]}</option>)}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>{pending ? t("common.saving") : t("admin_sub.grantCapability")}</Button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="space-y-2">
        {grants.filter((g) => g.revokedAt === null).map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-ink">{g.user.displayName} — {CAPABILITY_LABELS[g.capabilityKey as keyof typeof CAPABILITY_LABELS] ?? g.capabilityKey}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={revoking === g.id}
              onClick={async () => {
                setRevoking(g.id);
                await revokeCapabilityAction(g.userId, g.capabilityKey);
                setRevoking(null);
              }}
            >
              {t("common.revoke")}
            </Button>
          </div>
        ))}
        {grants.filter((g) => g.revokedAt === null).length === 0 && (
          <p className="text-sm text-ink-faint">{t("admin_sub.noCapabilityGrants")}</p>
        )}
      </div>
    </div>
  );
}
