"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createSalaryRecordAction } from "@/app/actions/employee-profile";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/locale-provider";
import { formatSalaryAmount, formatDate } from "@/lib/utils";

export type SalaryRecordRow = {
  id: string;
  effectiveStartDate: string | Date;
  effectiveEndDate: string | Date | null;
  currency: string;
  grossSalary: number;
  netSalary: number;
  paymentFrequency: string;
  status: string;
  createdAt: string | Date;
  createdBy: { displayName: string } | null;
  updatedBy: { displayName: string } | null;
};

export function SalaryHistoryList({ records }: { records: SalaryRecordRow[] }) {
  const { t } = useI18n();
  if (records.length === 0) return <p className="text-sm text-ink-muted">{t("hr_sub.noSalaryHistory")}</p>;

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border border-border p-3 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-lg font-semibold text-ink">
              {formatSalaryAmount(r.grossSalary, r.currency as "EUR" | "ALL")}
              <span className="text-xs font-normal text-ink-muted ml-1.5">{t("hr_sub.grossLabel")}</span>
            </p>
            <Badge tone={r.status === "CURRENT" ? "success" : "neutral"}>
              {r.status === "CURRENT" ? t("hr_sub.salaryCurrent") : t("hr_sub.salaryPrevious")}
            </Badge>
          </div>
          <p className="text-sm text-ink-muted">
            {formatSalaryAmount(r.netSalary, r.currency as "EUR" | "ALL")} {t("hr_sub.netLabel")} · {t(`hr_sub.frequency${r.paymentFrequency}`)}
          </p>
          <p className="text-xs text-ink-faint">
            {formatDate(r.effectiveStartDate)} — {r.effectiveEndDate ? formatDate(r.effectiveEndDate) : t("hr_sub.salaryOngoing")}
          </p>
          {r.createdBy && (
            <p className="text-xs text-ink-faint">
              {t("hr_sub.salaryCreatedBy")} {r.createdBy.displayName} · {formatDate(r.createdAt)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function AddSalaryRecordForm({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createSalaryRecordAction, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} /> {t("hr_sub.addSalaryRecord")}
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        setOpen(false);
      }}
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="effectiveStartDate">{t("hr_sub.effectiveStartDate")}</Label>
          <Input id="effectiveStartDate" name="effectiveStartDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{t("hr_sub.currency")}</Label>
          <select
            id="currency"
            name="currency"
            defaultValue="EUR"
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="EUR">EUR</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="grossSalary">{t("hr_sub.grossSalaryMinor")}</Label>
          <Input id="grossSalary" name="grossSalary" type="number" min={0} step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="netSalary">{t("hr_sub.netSalaryMinor")}</Label>
          <Input id="netSalary" name="netSalary" type="number" min={0} step="0.01" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paymentFrequency">{t("hr_sub.paymentFrequency")}</Label>
        <select
          id="paymentFrequency"
          name="paymentFrequency"
          defaultValue="MONTHLY"
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="MONTHLY">{t("hr_sub.frequencyMONTHLY")}</option>
          <option value="BIWEEKLY">{t("hr_sub.frequencyBIWEEKLY")}</option>
          <option value="WEEKLY">{t("hr_sub.frequencyWEEKLY")}</option>
          <option value="ANNUAL">{t("hr_sub.frequencyANNUAL")}</option>
        </select>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
