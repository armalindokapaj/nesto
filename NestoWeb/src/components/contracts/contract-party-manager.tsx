"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { addContractPartyAction, removeContractPartyAction } from "@/app/actions/contracts-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PARTY_ROLE_SUGGESTIONS, PARTY_ENTITY_TYPES } from "@/lib/contract-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export type ContractPartyRow = {
  id: string;
  legalName: string;
  role: string;
  representativeName: string | null;
  email: string | null;
  phone: string | null;
  signingAuthority: boolean;
};

// §14/§15 — a contract can have several parties, each with a configurable
// role; today's single contractorId FK on Contract still exists separately
// (untouched) — this is the additive, multi-party list.
export function ContractPartyManager({ contractId, parties, canWrite }: { contractId: string; parties: ContractPartyRow[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addContractPartyAction, undefined);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {parties.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {p.legalName}
                <span className="ml-1.5 text-xs font-normal text-ink-faint">· {p.role}</span>
                {p.signingAuthority && (
                  <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-px text-[10px] font-medium text-gold-deep">
                    {t("contractsModule.signingAuthority")}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-ink-muted">{[p.representativeName, p.email, p.phone].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            {canWrite && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => removeContractPartyAction(p.id, contractId))}
                className="shrink-0 text-ink-faint hover:text-danger"
                aria-label={t("common.remove")}
              >
                <X size={13} />
              </button>
            )}
          </li>
        ))}
        {parties.length === 0 && <p className="text-xs text-ink-faint">{t("contractsModule.noParties")}</p>}
      </ul>

      {canWrite && (
        <form action={formAction} className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2">
          <input type="hidden" name="contractId" value={contractId} />
          <Input name="legalName" placeholder={t("contractsModule.legalName")} required />
          <select
            name="role"
            defaultValue=""
            required
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="" disabled>
              {t("contractsModule.partyRole")}
            </option>
            {PARTY_ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            name="partyEntityType"
            defaultValue=""
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">{t("contractsModule.entityType")}</option>
            {PARTY_ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Input name="representativeName" placeholder={t("contractsModule.representative")} />
          <Input name="email" type="email" placeholder={t("common.email")} />
          <Input name="phone" placeholder={t("common.phone")} />
          <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
            <input type="checkbox" name="signingAuthority" className="rounded border-border" />
            {t("contractsModule.signingAuthority")}
          </label>
          <Button type="submit" size="sm" variant="secondary" disabled={pending} className="sm:col-span-2">
            {t("contractsModule.addParty")}
          </Button>
          {state && "error" in state && <p className="text-xs text-danger sm:col-span-2">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
