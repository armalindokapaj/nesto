"use client";

import { useActionState, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createShiftDefinitionAction, assignScheduleAction, endScheduleAssignmentAction, clockAction } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function DialogShell({ trigger, title, open, onOpenChange, children }: { trigger: React.ReactNode; title: string; open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CreateShiftDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createShiftDefinitionAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("attendance.newShift")}</Button>} title={t("attendance.newShift")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="name">{t("attendance.shiftName")}</Label><Input id="name" name="name" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="startTime">{t("attendance.startTime")}</Label><Input id="startTime" name="startTime" type="time" defaultValue="09:00" required /></div>
          <div className="space-y-1.5"><Label htmlFor="endTime">{t("attendance.endTime")}</Label><Input id="endTime" name="endTime" type="time" defaultValue="17:00" required /></div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("attendance.daysOfWeek")}</Label>
          <div className="flex flex-wrap gap-3">
            {DAY_CODES.map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" name={`day_${d}`} defaultChecked={["MON", "TUE", "WED", "THU", "FRI"].includes(d)} />
                {t(`attendance.day_${d}`)}
              </label>
            ))}
          </div>
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function AssignScheduleForm({ employees, shifts }: { employees: { id: string; fullName: string }[]; shifts: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <select className={SELECT_CLASS} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="" disabled>{t("attendance.employee")}</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
      </select>
      <select className={SELECT_CLASS} value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
        <option value="" disabled>{t("attendance.shift")}</option>
        {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Button
        size="sm"
        disabled={!employeeId || !shiftId || pending}
        onClick={() => startTransition(async () => { await assignScheduleAction(employeeId, shiftId); setEmployeeId(""); setShiftId(""); })}
      >
        {t("attendance.assign")}
      </Button>
    </div>
  );
}

export function EndAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => endScheduleAssignmentAction(assignmentId)}>{t("attendance.endAssignment")}</Button>;
}

export function ClockButton({ clockedIn }: { clockedIn: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ error: string } | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant={clockedIn ? "secondary" : "primary"}
        disabled={pending}
        onClick={() => startTransition(async () => setState(await clockAction(clockedIn ? "CLOCK_OUT" : "CLOCK_IN")))}
      >
        {clockedIn ? t("attendance.clockOut") : t("attendance.clockIn")}
      </Button>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
    </div>
  );
}
