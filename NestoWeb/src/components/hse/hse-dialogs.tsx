"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createHazardAction,
  createRiskAssessmentAction,
  requestPermitToWorkAction,
  issueStopWorkOrderAction,
  releaseStopWorkOrderAction,
  approveRiskAssessmentAction,
  setPermitToWorkStatusAction,
} from "@/app/actions/hse";
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

type Project = { id: string; name: string; code: string };

function ProjectSelect({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  return (
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
  );
}

export function CreateHazardDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createHazardAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm">
          <Plus size={14} /> {t("hse.newHazard")}
        </Button>
      }
      title={t("hse.newHazard")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="projectId">{t("legal.project")}</Label>
          <ProjectSelect projects={projects} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">{t("hse.hazardTitle")}</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t("common.description")}</Label>
          <Input id="description" name="description" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="likelihood">{t("hse.likelihood")}</Label>
            <select id="likelihood" name="likelihood" defaultValue="POSSIBLE" className={SELECT_CLASS}>
              {["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"].map((v) => (
                <option key={v} value={v}>
                  {t(`hse.likelihood_${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="severity">{t("hse.severity")}</Label>
            <select id="severity" name="severity" defaultValue="MODERATE" className={SELECT_CLASS}>
              {["MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"].map((v) => (
                <option key={v} value={v}>
                  {t(`hse.severity_${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="controlLevel">{t("hse.controlLevel")}</Label>
          <select id="controlLevel" name="controlLevel" defaultValue="ADMINISTRATIVE" className={SELECT_CLASS}>
            {["ELIMINATE", "SUBSTITUTE", "ENGINEERING", "ADMINISTRATIVE", "PPE"].map((v) => (
              <option key={v} value={v}>
                {t(`hse.controlLevel_${v}`)}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-faint">{t("hse.hierarchyHint")}</p>
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.saving") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function CreateRiskAssessmentForm({ projectId, hazardId }: { projectId: string; hazardId?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createRiskAssessmentAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
      <input type="hidden" name="projectId" value={projectId} />
      {hazardId && <input type="hidden" name="hazardId" value={hazardId} />}
      <div className="flex-1 min-w-[10rem] space-y-1.5">
        <Label htmlFor="raTitle">{t("hse.riskAssessments")}</Label>
        <Input id="raTitle" name="title" required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t("hse.newRiskAssessment")}
      </Button>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ApproveRiskAssessmentButton({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { t } = useI18n();
  return (
    <Button size="sm" variant="secondary" onClick={() => approveRiskAssessmentAction(riskAssessmentId)}>
      {t("hse.raStatus_APPROVED")}
    </Button>
  );
}

export function RequestPermitToWorkDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(requestPermitToWorkAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm">
          <Plus size={14} /> {t("hse.newPermitToWork")}
        </Button>
      }
      title={t("hse.newPermitToWork")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="projectId">{t("legal.project")}</Label>
          <ProjectSelect projects={projects} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="permitType">{t("legal.permitType")}</Label>
          <select id="permitType" name="permitType" defaultValue="HOT_WORK" className={SELECT_CLASS}>
            {[
              "HOT_WORK",
              "CONFINED_SPACE_ENTRY",
              "WORKING_AT_HEIGHT",
              "EXCAVATION",
              "ELECTRICAL_ISOLATION",
              "LIFTING",
              "RADIOGRAPHY",
              "DEMOLITION",
              "OTHER",
            ].map((v) => (
              <option key={v} value={v}>
                {t(`hse.permitTypeToWork_${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t("common.description")}</Label>
          <Input id="description" name="description" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="validFrom">{t("hr_sub.effectiveStartDate")}</Label>
            <Input id="validFrom" name="validFrom" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="validTo">{t("legal.expiryDate")}</Label>
            <Input id="validTo" name="validTo" type="date" />
          </div>
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.creating") : t("common.create")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function PermitToWorkStatusActions({ permitId, status }: { permitId: string; status: string }) {
  const { t } = useI18n();
  const next: Record<string, { status: string; labelKey: string }[]> = {
    DRAFT: [{ status: "ACTIVE", labelKey: "hse.activate" }],
    ACTIVE: [
      { status: "SUSPENDED", labelKey: "hse.suspend" },
      { status: "CLOSED", labelKey: "hse.close" },
    ],
    SUSPENDED: [{ status: "ACTIVE", labelKey: "hse.activate" }],
  };
  const options = next[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <Button key={o.status} size="sm" variant="secondary" onClick={() => setPermitToWorkStatusAction(permitId, o.status)}>
          {t(o.labelKey)}
        </Button>
      ))}
    </div>
  );
}

export function IssueStopWorkDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(issueStopWorkOrderAction, undefined);
  return (
    <DialogShell
      trigger={
        <Button size="sm" variant="danger">
          <Plus size={14} /> {t("hse.newStopWork")}
        </Button>
      }
      title={t("hse.newStopWork")}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="projectId">{t("legal.project")}</Label>
          <ProjectSelect projects={projects} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scopeType">{t("hse.scopeType")}</Label>
          <select id="scopeType" name="scopeType" defaultValue="PROJECT" className={SELECT_CLASS}>
            {["PROJECT", "ZONE", "WORK_PACKAGE", "CONTRACTOR", "ASSET", "PERMIT", "ACTIVITY", "MATERIAL"].map((v) => (
              <option key={v} value={v}>
                {t(`hse.scopeType_${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scopeRef">{t("hse.scopeRef")}</Label>
          <Input id="scopeRef" name="scopeRef" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">{t("hse.reason")}</Label>
          <Input id="reason" name="reason" required />
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" variant="danger" disabled={pending} className="w-full">
          {pending ? t("common.saving") : t("hse.newStopWork")}
        </Button>
      </form>
    </DialogShell>
  );
}

export function ReleaseStopWorkForm({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(releaseStopWorkOrderAction, undefined);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {t("hse.release")}
      </Button>
    );
  }
  return (
    <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-2.5 rounded-lg border border-border p-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="space-y-1.5">
        <Label htmlFor="releaseNotes">{t("hse.releaseNotes")}</Label>
        <Input id="releaseNotes" name="releaseNotes" required />
      </div>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("hse.release")}
      </Button>
    </form>
  );
}
