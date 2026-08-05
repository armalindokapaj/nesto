"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { recordEmploymentChangeAction } from "@/app/actions/hr";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type Props = {
  employeeId: string;
  currentJobTitle?: string;
  currentDepartment?: string;
  managers: { id: string; fullName: string; position: string }[];
  hasCurrentRelationship: boolean;
};

// PRD_HR_Payroll_Workforce Phase 1 — every submit here creates a NEW
// EmploymentRelationship row (closing whatever was ACTIVE), never edits one
// in place. "isTransfer" is the PRD's intercompany-transfer flag; unchecked,
// this is just recording an ordinary employment update (promotion, transfer
// between departments, contract-type change, etc.).
export function RecordEmploymentDialog({ employeeId, currentJobTitle, currentDepartment, managers, hasCurrentRelationship }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(recordEmploymentChangeAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("hr_sub.recordEmploymentChange")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("hr_sub.recordEmploymentChange")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            <input type="hidden" name="employeeId" value={employeeId} />
            <p className="text-xs text-ink-faint">{t("hr_sub.employmentChangeHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="employmentType">{t("hr_sub.employmentType")}</Label>
                <select id="employmentType" name="employmentType" defaultValue="EMPLOYEE" className={SELECT_CLASS}>
                  <option value="EMPLOYEE">{t("hr_sub.employmentType_EMPLOYEE")}</option>
                  <option value="CONTRACTOR">{t("hr_sub.employmentType_CONTRACTOR")}</option>
                  <option value="EXTERNAL">{t("hr_sub.employmentType_EXTERNAL")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractType">{t("hr_sub.contractType")}</Label>
                <select id="contractType" name="contractType" defaultValue="FULL_TIME" className={SELECT_CLASS}>
                  <option value="FULL_TIME">{t("hr_sub.contractType_FULL_TIME")}</option>
                  <option value="PART_TIME">{t("hr_sub.contractType_PART_TIME")}</option>
                  <option value="FIXED_TERM">{t("hr_sub.contractType_FIXED_TERM")}</option>
                  <option value="SEASONAL">{t("hr_sub.contractType_SEASONAL")}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">{t("hr_sub.jobTitle")}</Label>
              <Input id="jobTitle" name="jobTitle" defaultValue={currentJobTitle} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">{t("common.department")}</Label>
              <Input id="department" name="department" defaultValue={currentDepartment} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reportsToId">{t("hr_sub.reportsTo")}</Label>
              <select id="reportsToId" name="reportsToId" defaultValue="" className={SELECT_CLASS}>
                <option value="">{t("common.none")}</option>
                {managers
                  .filter((m) => m.id !== employeeId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} — {m.position}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effectiveStartDate">{t("hr_sub.effectiveStartDate")}</Label>
              <Input id="effectiveStartDate" name="effectiveStartDate" type="date" required />
            </div>
            {hasCurrentRelationship && (
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" name="isTransfer" value="true" className="rounded border-border" />
                {t("hr_sub.isIntercompanyTransfer")}
              </label>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("common.notes")}</Label>
              <Input id="notes" name="notes" />
            </div>

            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
