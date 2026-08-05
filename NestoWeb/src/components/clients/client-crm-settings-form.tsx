"use client";

import { useActionState } from "react";
import { updateClientCrmFieldsAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SuggestInput } from "@/components/ui/suggest-input";
import { CLIENT_TYPE_SUGGESTIONS } from "@/lib/crm-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ClientCrmSettingsForm({
  clientId,
  clientType,
  ownerId,
  source,
  country,
  members,
}: {
  clientId: string;
  clientType: string | null;
  ownerId: string | null;
  source: string | null;
  country: string | null;
  members: { id: string; displayName: string }[];
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateClientCrmFieldsAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-1.5">
        <Label htmlFor="client-type">{t("crm.clientType")}</Label>
        <SuggestInput id="client-type" name="clientType" suggestions={CLIENT_TYPE_SUGGESTIONS} defaultValue={clientType ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-owner">{t("crm.assignedOwner")}</Label>
        <select
          id="client-owner"
          name="ownerId"
          defaultValue={ownerId ?? ""}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="">{t("common.none")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-source">{t("crm.source")}</Label>
        <Input id="client-source" name="source" defaultValue={source ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-country">{t("crm.country")}</Label>
        <Input id="client-country" name="country" defaultValue={country ?? ""} />
      </div>
      {state && "error" in state && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
