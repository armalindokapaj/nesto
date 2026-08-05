"use client";

import { useActionState } from "react";
import { updateContractDetailsAction } from "@/app/actions/contracts-module";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SuggestInput } from "@/components/ui/suggest-input";
import { CONTRACT_TYPE_SUGGESTIONS } from "@/lib/contract-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ContractDetailsForm({
  contractId,
  contractType,
  responsibleUserId,
  members,
}: {
  contractId: string;
  contractType: string | null;
  responsibleUserId: string | null;
  members: { id: string; displayName: string }[];
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateContractDetailsAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contractId" value={contractId} />
      <div className="space-y-1.5">
        <Label htmlFor="contract-type">{t("contractsModule.contractType")}</Label>
        <SuggestInput id="contract-type" name="contractType" suggestions={CONTRACT_TYPE_SUGGESTIONS} defaultValue={contractType ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contract-responsible">{t("contractsModule.responsibleUser")}</Label>
        <select
          id="contract-responsible"
          name="responsibleUserId"
          defaultValue={responsibleUserId ?? ""}
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
