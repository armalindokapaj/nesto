"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createExternalOrganizationAction,
  addPortalMemberAction,
  removePortalMemberAction,
  grantProjectAccessAction,
  revokeProjectAccessAction,
} from "@/app/actions/portal-access";
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

export function CreateOrgDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createExternalOrganizationAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("portalAccess.newOrg")}</Button>} title={t("portalAccess.newOrg")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="name">{t("portalAccess.orgName")}</Label><Input id="name" name="name" required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="orgType">{t("portalAccess.orgType")}</Label>
          <select id="orgType" name="orgType" defaultValue="CLIENT" className={SELECT_CLASS}>
            {["CLIENT", "SUPPLIER"].map((v) => <option key={v} value={v}>{t(`portalAccess.orgType_${v}`)}</option>)}
          </select>
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function AddMemberForm({ externalOrgId, users }: { externalOrgId: string; users: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  return (
    <div className="flex gap-2">
      <select className={SELECT_CLASS} value={userId} onChange={(e) => setUserId(e.target.value)}>
        <option value="" disabled>{t("common.select")}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
      </select>
      <Button size="sm" disabled={!userId} onClick={() => { addPortalMemberAction(externalOrgId, userId); setUserId(""); }}>{t("portalAccess.addMember")}</Button>
    </div>
  );
}

export function RemoveMemberButton({ membershipId }: { membershipId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => removePortalMemberAction(membershipId)}>{t("common.remove")}</Button>;
}

export function GrantProjectAccessForm({ externalOrgId, projects }: { externalOrgId: string; projects: { id: string; name: string; code: string }[] }) {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState("");
  return (
    <div className="flex gap-2">
      <select className={SELECT_CLASS} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="" disabled>{t("common.select")}</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
      </select>
      <Button size="sm" disabled={!projectId} onClick={() => { grantProjectAccessAction(externalOrgId, projectId); setProjectId(""); }}>{t("portalAccess.grantAccess")}</Button>
    </div>
  );
}

export function RevokeAccessButton({ accessId }: { accessId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={() => revokeProjectAccessAction(accessId)}>{t("portalAccess.revokeAccess")}</Button>;
}
