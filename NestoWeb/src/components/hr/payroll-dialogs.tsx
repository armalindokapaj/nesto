"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createPayrollGroupAction,
  createPayrollRunAction,
  calculatePayrollRunAction,
  lockPayrollRunAction,
  cancelPayrollRunAction,
  createAdjustmentRunAction,
} from "@/app/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

function DialogShell({
  trigger,
  title,
  open,
  onOpenChange,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CreatePayrollGroupDialog({ companies }: { companies: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPayrollGroupAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("payroll.newGroup")}
        </Button>
      }
      title={t("payroll.newGroup")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="companyId">{t("payroll.company")}</Label>
          <select id="companyId" name="companyId" defaultValue="" className={SELECT_CLASS} required>
            <option value="" disabled>
              {t("payroll.selectCompany")}
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="frequency">{t("hr_sub.paymentFrequency")}</Label>
            <select id="frequency" name="frequency" defaultValue="MONTHLY" className={SELECT_CLASS}>
              {["MONTHLY", "BIWEEKLY", "WEEKLY", "ANNUAL"].map((f) => (
                <option key={f} value={f}>
                  {t(`hr_sub.frequency${f}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t("hr_sub.currency")}</Label>
            <select id="currency" name="currency" defaultValue="EUR" className={SELECT_CLASS}>
              <option value="EUR">EUR</option>
              <option value="ALL">ALL</option>
            </select>
          </div>
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.saving") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function CreatePayrollRunDialog({ groups }: { groups: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPayrollRunAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm">
          <Plus size={14} /> {t("payroll.newRun")}
        </Button>
      }
      title={t("payroll.newRun")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="payrollGroupId">{t("payroll.group")}</Label>
          <select id="payrollGroupId" name="payrollGroupId" defaultValue="" className={SELECT_CLASS} required>
            <option value="" disabled>
              {t("payroll.selectGroup")}
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="periodStart">{t("payroll.periodStart")}</Label>
            <Input id="periodStart" name="periodStart" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="periodEnd">{t("payroll.periodEnd")}</Label>
            <Input id="periodEnd" name="periodEnd" type="date" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payDate">{t("payroll.payDate")}</Label>
          <Input id="payDate" name="payDate" type="date" required />
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.creating") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function PayrollRunActions({ runId, status }: { runId: string; status: string }) {
  const { t } = useI18n();
  if (status === "DRAFT" || status === "CALCULATED") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => calculatePayrollRunAction(runId)}>
          {t("payroll.calculate")}
        </Button>
        {status === "CALCULATED" && (
          <Button size="sm" onClick={() => lockPayrollRunAction(runId)}>
            {t("payroll.lock")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => cancelPayrollRunAction(runId)}>
          {t("payroll.cancel")}
        </Button>
      </div>
    );
  }
  return null;
}

export function CreateAdjustmentRunForm({ adjustsRunId }: { adjustsRunId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAdjustmentRunAction, undefined);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {t("payroll.createAdjustment")}
      </Button>
    );
  }
  return (
    <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-2.5 rounded-lg border border-border p-3">
      <input type="hidden" name="adjustsRunId" value={adjustsRunId} />
      <p className="text-xs text-ink-faint">{t("payroll.adjustmentHint")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="adjPayDate">{t("payroll.payDate")}</Label>
        <Input id="adjPayDate" name="payDate" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">{t("common.notes")}</Label>
        <Input id="reason" name="reason" />
      </div>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("payroll.createAdjustment")}
      </Button>
    </form>
  );
}
