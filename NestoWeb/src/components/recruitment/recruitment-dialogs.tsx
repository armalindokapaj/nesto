"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createVacancyAction,
  setVacancyStatusAction,
  createCandidateAction,
  setCandidateStageAction,
  createOfferAction,
  setOfferStatusAction,
} from "@/app/actions/recruitment";
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

export function CreateVacancyDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createVacancyAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("recruitment.newVacancy")}</Button>} title={t("recruitment.newVacancy")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="title">{t("recruitment.vacancyTitle")}</Label><Input id="title" name="title" required /></div>
        <div className="space-y-1.5"><Label htmlFor="department">{t("common.department")}</Label><Input id="department" name="department" /></div>
        <div className="space-y-1.5"><Label htmlFor="position">{t("recruitment.position")}</Label><Input id="position" name="position" /></div>
        <div className="space-y-1.5"><Label htmlFor="headcount">{t("recruitment.headcount")}</Label><Input id="headcount" name="headcount" type="number" min={1} defaultValue={1} /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function VacancyStatusActions({ vacancyId, status }: { vacancyId: string; status: string }) {
  const { t } = useI18n();
  const next: Record<string, string[]> = { OPEN: ["ON_HOLD", "FILLED", "CANCELLED"], ON_HOLD: ["OPEN", "CANCELLED"], FILLED: [], CANCELLED: [] };
  const options = next[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => setVacancyStatusAction(vacancyId, s)}>{t(`recruitment.vacancyStatus_${s}`)}</Button>
      ))}
    </div>
  );
}

export function CreateCandidateDialog({ vacancyId }: { vacancyId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCandidateAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("recruitment.newCandidate")}</Button>} title={t("recruitment.newCandidate")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <input type="hidden" name="vacancyId" value={vacancyId} />
        <div className="space-y-1.5"><Label htmlFor="fullName">{t("common.name")}</Label><Input id="fullName" name="fullName" required /></div>
        <div className="space-y-1.5"><Label htmlFor="email">{t("common.email")}</Label><Input id="email" name="email" type="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">{t("common.phone")}</Label><Input id="phone" name="phone" /></div>
        <div className="space-y-1.5"><Label htmlFor="source">{t("recruitment.source")}</Label><Input id="source" name="source" /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </DialogShell>
  );
}

export function CandidateStageActions({ candidateId, vacancyId, stage }: { candidateId: string; vacancyId: string; stage: string }) {
  const { t } = useI18n();
  const next: Record<string, string[]> = {
    APPLIED: ["SCREENING", "REJECTED"],
    SCREENING: ["INTERVIEW", "REJECTED"],
    INTERVIEW: ["OFFER", "REJECTED"],
    OFFER: ["HIRED", "REJECTED"],
    HIRED: [],
    REJECTED: [],
  };
  const options = next[stage] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant={s === "REJECTED" ? "ghost" : "secondary"} onClick={() => setCandidateStageAction(candidateId, vacancyId, s)}>
          {t(`recruitment.stage_${s}`)}
        </Button>
      ))}
    </div>
  );
}

export function CreateOfferDialog({ candidateId, vacancyId }: { candidateId: string; vacancyId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createOfferAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm" variant="secondary">{t("recruitment.extendOffer")}</Button>} title={t("recruitment.extendOffer")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <input type="hidden" name="candidateId" value={candidateId} />
        <input type="hidden" name="vacancyId" value={vacancyId} />
        <div className="space-y-1.5"><Label htmlFor="position">{t("recruitment.position")}</Label><Input id="position" name="position" required /></div>
        <div className="space-y-1.5"><Label htmlFor="compensation">{t("recruitment.compensation")}</Label><Input id="compensation" name="compensation" type="number" step="0.01" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{t("recruitment.currency")}</Label>
          <select id="currency" name="currency" defaultValue="EUR" className={SELECT_CLASS}>
            {["EUR", "ALL"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="w-full">{t("recruitment.sendOffer")}</Button>
      </form>
    </DialogShell>
  );
}

export function OfferStatusActions({ offerId, vacancyId, status }: { offerId: string; vacancyId: string; status: string }) {
  const { t } = useI18n();
  const next: Record<string, string[]> = { DRAFT: ["SENT", "WITHDRAWN"], SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN"], ACCEPTED: [], DECLINED: [], WITHDRAWN: [] };
  const options = next[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant={s === "ACCEPTED" ? "primary" : "ghost"} onClick={() => setOfferStatusAction(offerId, vacancyId, s)}>
          {t(`recruitment.offerStatus_${s}`)}
        </Button>
      ))}
    </div>
  );
}
