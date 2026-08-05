"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createAuthorityAction,
  createPermitAction,
  addPermitConditionAction,
  amendPermitAction,
  setLegalReadinessStatusAction,
  setPermitStatusAction,
} from "@/app/actions/legal";
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

export function CreateAuthorityDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAuthorityAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("legal.newAuthority")}
        </Button>
      }
      title={t("legal.newAuthority")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">{t("legal.authorityCategory")}</Label>
          <select id="category" name="category" defaultValue="MUNICIPAL" className={SELECT_CLASS}>
            {["MUNICIPAL", "NATIONAL", "UTILITY", "FIRE", "ENVIRONMENTAL", "OTHER"].map((c) => (
              <option key={c} value={c}>
                {t(`legal.authorityCategory_${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactInfo">{t("legal.contactInfo")}</Label>
          <Input id="contactInfo" name="contactInfo" />
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.saving") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function CreatePermitDialog({
  projects,
  authorities,
}: {
  projects: { id: string; name: string; code: string }[];
  authorities: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPermitAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm">
          <Plus size={14} /> {t("legal.newPermit")}
        </Button>
      }
      title={t("legal.newPermit")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="projectId">{t("legal.project")}</Label>
          <select id="projectId" name="projectId" defaultValue="" className={SELECT_CLASS} required>
            <option value="" disabled>
              {t("legal.selectProject")}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="authorityId">{t("legal.authority")}</Label>
          <select id="authorityId" name="authorityId" defaultValue="" className={SELECT_CLASS} required>
            <option value="" disabled>
              {t("legal.selectAuthority")}
            </option>
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="permitType">{t("legal.permitType")}</Label>
          <select id="permitType" name="permitType" defaultValue="BUILDING" className={SELECT_CLASS}>
            {["BUILDING", "ENVIRONMENTAL", "OCCUPANCY", "DEMOLITION", "UTILITY_CONNECTION", "OTHER"].map((p) => (
              <option key={p} value={p}>
                {t(`legal.permitType_${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="referenceNumber">{t("legal.referenceNumber")}</Label>
          <Input id="referenceNumber" name="referenceNumber" />
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.creating") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function AddPermitConditionForm({ permitId }: { permitId: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addPermitConditionAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
      <input type="hidden" name="permitId" value={permitId} />
      <div className="flex-1 min-w-[10rem] space-y-1.5">
        <Label htmlFor="description">{t("legal.conditionDescription")}</Label>
        <Input id="description" name="description" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dueDate">{t("legal.dueDate")}</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t("common.add")}
      </Button>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function AmendPermitForm({ permitId }: { permitId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(amendPermitAction, undefined);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {t("legal.recordAmendment")}
      </Button>
    );
  }
  return (
    <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-2.5 rounded-lg border border-border p-3">
      <input type="hidden" name="permitId" value={permitId} />
      <p className="text-xs text-ink-faint">{t("legal.amendmentHint")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="amendDescription">{t("legal.conditionDescription")}</Label>
        <Input id="amendDescription" name="description" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newExpiryDate">{t("legal.newExpiryDate")}</Label>
        <Input id="newExpiryDate" name="newExpiryDate" type="date" />
      </div>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}

export function PermitStatusActions({ permitId, status }: { permitId: string; status: string }) {
  const { t } = useI18n();
  const next: Record<string, string[]> = {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["ISSUED", "REJECTED"],
    ISSUED: ["REVOKED", "EXPIRED"],
  };
  const options = next[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => setPermitStatusAction(permitId, s)}>
          {t(`legal.permitStatus_${s}`)}
        </Button>
      ))}
    </div>
  );
}

export function SetReadinessForm({ projectId, currentStatus }: { projectId: string; currentStatus: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setLegalReadinessStatusAction, undefined);
  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor="status">{t("legal.readinessGate")}</Label>
        <select id="status" name="status" defaultValue={currentStatus} className={SELECT_CLASS}>
          {["READY", "READY_WITH_CONDITIONS", "RESTRICTED", "BLOCKED", "UNKNOWN"].map((s) => (
            <option key={s} value={s}>
              {t(`legal.readinessStatus_${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">{t("legal.readinessReason")}</Label>
        <Input id="reason" name="reason" />
      </div>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
