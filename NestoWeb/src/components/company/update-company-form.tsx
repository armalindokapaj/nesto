"use client";

import { useTransition } from "react";
import { updateCompanyProfileAction } from "@/app/actions/company";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function UpdateCompanyForm({ legalName, countryCode }: { legalName: string; countryCode: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updateCompanyProfileAction(formData))}
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl"
    >
      <div className="space-y-1.5">
        <Label htmlFor="legalName">{t("company.legalName")}</Label>
        <Input id="legalName" name="legalName" defaultValue={legalName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="countryCode">{t("company.country")}</Label>
        <Input id="countryCode" name="countryCode" defaultValue={countryCode} maxLength={2} required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? t("common.saving") : t("company.updateProfile")}
        </Button>
      </div>
    </form>
  );
}
