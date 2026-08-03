"use client";

import { useActionState } from "react";
import { updateContractorFinancialDetailsAction } from "@/app/actions/contractors";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ContractorFinancialForm({
  contractorId,
  taxId,
  bankAccount,
}: {
  contractorId: string;
  taxId: string | null;
  bankAccount: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateContractorFinancialDetailsAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
      <input type="hidden" name="contractorId" value={contractorId} />
      <div className="space-y-1.5">
        <Label htmlFor="taxId">{t("contractors.taxId")}</Label>
        <Input id="taxId" name="taxId" defaultValue={taxId ?? ""} placeholder="L01234567A" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankAccount">{t("contractors.bankAccount")}</Label>
        <Input id="bankAccount" name="bankAccount" defaultValue={bankAccount ?? ""} placeholder="AL47 2121 1009 ..." />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {state?.success && <p className="text-xs text-success">{t("common.save")} ✓</p>}
        {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
