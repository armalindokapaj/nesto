"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createItDeviceAction,
  setItDeviceStatusAction,
  createSoftwareLicenceAction,
  assignLicenceSeatAction,
  revokeLicenceSeatAction,
  createItTicketAction,
  setItTicketStatusAction,
  addItTicketCommentAction,
} from "@/app/actions/it-admin";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

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

export function CreateDeviceDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createItDeviceAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("itAdmin.newDevice")}</Button>} title={t("itAdmin.newDevice")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="name">{t("itAdmin.deviceName")}</Label><Input id="name" name="name" required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="deviceType">{t("itAdmin.deviceType")}</Label>
          <select id="deviceType" name="deviceType" defaultValue="LAPTOP" className={SELECT_CLASS}>
            {["LAPTOP", "DESKTOP", "MOBILE", "TABLET", "SERVER", "NETWORK", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="serialNumber">{t("itAdmin.serialNumber")}</Label><Input id="serialNumber" name="serialNumber" /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function DeviceStatusActions({ deviceId, status }: { deviceId: string; status: string }) {
  const { t } = useI18n();
  if (status !== "ACTIVE") return null;
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setItDeviceStatusAction(deviceId, "IN_REPAIR")}>{t("itAdmin.markInRepair")}</Button>
      <Button size="sm" variant="ghost" onClick={() => setItDeviceStatusAction(deviceId, "RETIRED")}>{t("common.archive")}</Button>
    </div>
  );
}

export function CreateLicenceDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createSoftwareLicenceAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("itAdmin.newLicence")}</Button>} title={t("itAdmin.newLicence")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="productName">{t("itAdmin.productName")}</Label><Input id="productName" name="productName" required /></div>
        <div className="space-y-1.5"><Label htmlFor="vendor">{t("itAdmin.vendor")}</Label><Input id="vendor" name="vendor" /></div>
        <div className="space-y-1.5"><Label htmlFor="seatsTotal">{t("itAdmin.seatsTotal")}</Label><Input id="seatsTotal" name="seatsTotal" type="number" min={1} defaultValue={1} required /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function AssignSeatForm({ licenceId, users }: { licenceId: string; users: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  return (
    <div className="flex gap-2">
      <select className={SELECT_CLASS} value={userId} onChange={(e) => setUserId(e.target.value)}>
        <option value="" disabled>{t("common.select")}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
      </select>
      <Button size="sm" disabled={!userId} onClick={() => assignLicenceSeatAction(licenceId, userId)}>{t("itAdmin.assignSeat")}</Button>
    </div>
  );
}

export function RevokeSeatButton({ assignmentId }: { assignmentId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => revokeLicenceSeatAction(assignmentId)}>{t("itAdmin.revokeSeat")}</Button>;
}

export function CreateTicketDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createItTicketAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("itAdmin.newTicket")}</Button>} title={t("itAdmin.newTicket")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="ticketType">{t("itAdmin.ticketType")}</Label>
          <select id="ticketType" name="ticketType" defaultValue="REQUEST" className={SELECT_CLASS}>
            {["REQUEST", "INCIDENT", "PROBLEM", "CHANGE"].map((v) => <option key={v} value={v}>{t(`itAdmin.ticketType_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="title">{t("common.name")}</Label><Input id="title" name="title" required /></div>
        <div className="space-y-1.5"><Label htmlFor="description">{t("common.description")}</Label><Input id="description" name="description" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">{t("itAdmin.priority")}</Label>
          <select id="priority" name="priority" defaultValue="MEDIUM" className={SELECT_CLASS}>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{t(`itAdmin.priority_${v}`)}</option>)}
          </select>
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function TicketStatusActions({ ticketId, status }: { ticketId: string; status: string }) {
  const { t } = useI18n();
  const next: Record<string, string[]> = { OPEN: ["IN_PROGRESS", "CLOSED"], IN_PROGRESS: ["RESOLVED", "OPEN"], RESOLVED: ["CLOSED", "IN_PROGRESS"], CLOSED: [] };
  const options = next[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => setItTicketStatusAction(ticketId, s)}>{t(`itAdmin.status_${s}`)}</Button>
      ))}
    </div>
  );
}

export function AddTicketCommentForm({ ticketId }: { ticketId: string }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(addItTicketCommentAction, undefined);
  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Input name="body" placeholder={t("common.comment")} className="flex-1" required />
      <Button type="submit" size="sm">{t("itAdmin.addComment")}</Button>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
