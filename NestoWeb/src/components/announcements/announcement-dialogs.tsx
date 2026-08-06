"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, AlertTriangle } from "lucide-react";
import {
  createAnnouncementAction,
  acknowledgeAnnouncementAction,
  activateEmergencyAlertAction,
  resolveEmergencyAlertAction,
} from "@/app/actions/event-centre";
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

export function CreateAnnouncementDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAnnouncementAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("announcements.newAnnouncement")}</Button>} title={t("announcements.newAnnouncement")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="title">{t("announcements.announcementTitle")}</Label><Input id="title" name="title" required /></div>
        <div className="space-y-1.5"><Label htmlFor="body">{t("announcements.body")}</Label><Input id="body" name="body" required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="audienceType">{t("announcements.audienceType")}</Label>
          <select id="audienceType" name="audienceType" defaultValue="ALL" className={SELECT_CLASS}>
            {["ALL", "ROLE", "DEPARTMENT"].map((v) => <option key={v} value={v}>{t(`announcements.audienceType_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="audienceValue">{t("announcements.audienceValue")}</Label><Input id="audienceValue" name="audienceValue" /></div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="mandatoryAck" /> {t("announcements.mandatoryAck")}
        </label>
        {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function AcknowledgeButton({ announcementId }: { announcementId: string }) {
  const { t } = useI18n();
  return <Button size="sm" onClick={() => acknowledgeAnnouncementAction(announcementId)}>{t("announcements.acknowledge")}</Button>;
}

export function ActivateAlertDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(activateEmergencyAlertAction, undefined);
  return (
    <DialogShell
      trigger={<Button size="sm" variant="danger"><AlertTriangle size={14} /> {t("announcements.activateAlert")}</Button>}
      title={t("announcements.activateAlert")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="title">{t("announcements.announcementTitle")}</Label><Input id="title" name="title" required /></div>
        <div className="space-y-1.5"><Label htmlFor="body">{t("announcements.body")}</Label><Input id="body" name="body" required /></div>
        {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" variant="danger" className="w-full">{t("announcements.activateAlert")}</Button>
      </form>
    </DialogShell>
  );
}

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="secondary" onClick={() => resolveEmergencyAlertAction(alertId)}>{t("announcements.resolveAlert")}</Button>;
}
