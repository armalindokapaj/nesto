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
  createInspectionAction,
  completeInspectionAction,
  createObservationAction,
  closeObservationAction,
  createIncidentAction,
  transitionIncidentAction,
  createCorrectiveActionAction,
  transitionCorrectiveActionAction,
  createInductionAction,
  createToolboxTalkAction,
  addEmergencyContactAction,
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

// ---------------------------------------------------------------------------
// PRD_HSE_Module §49.1 Phase 1 rework — Inspections, Observations, Incidents,
// Corrective Actions, Inductions, Toolbox Talks, Emergency Contacts.
// ---------------------------------------------------------------------------

export function CreateInspectionDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInspectionAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("hse.newInspection")}</Button>} title={t("hse.newInspection")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="type">{t("hse.category")}</Label>
          <select id="type" name="type" defaultValue="SITE_SAFETY" className={SELECT_CLASS}>
            {["SITE_SAFETY", "SCAFFOLD", "EQUIPMENT", "ELECTRICAL", "ENVIRONMENTAL", "OTHER"].map((v) => <option key={v} value={v}>{t(`hse.inspectionType_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="location">{t("hse.location")}</Label><Input id="location" name="location" /></div>
        <div className="space-y-1.5"><Label htmlFor="findings">{t("hse.findings")}</Label><Input id="findings" name="findings" /></div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}

export function CompleteInspectionActions({ inspectionId, status }: { inspectionId: string; status: string }) {
  const { t } = useI18n();
  if (status !== "DRAFT") return null;
  return (
    <div className="flex gap-2">
      {["PASS", "CONDITIONAL", "FAIL"].map((outcome) => (
        <Button key={outcome} size="sm" variant="secondary" onClick={() => completeInspectionAction(inspectionId, outcome)}>{t(`hse.inspectionOutcome_${outcome}`)}</Button>
      ))}
    </div>
  );
}

export function CreateObservationDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createObservationAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("hse.newObservation")}</Button>} title={t("hse.newObservation")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="type">{t("hse.category")}</Label>
          <select id="type" name="type" defaultValue="UNSAFE_ACT" className={SELECT_CLASS}>
            {["SAFE_ACT", "UNSAFE_ACT", "SAFE_CONDITION", "UNSAFE_CONDITION", "NEAR_MISS"].map((v) => <option key={v} value={v}>{t(`hse.observationType_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="description">{t("common.description")}</Label><Input id="description" name="description" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="location">{t("hse.location")}</Label><Input id="location" name="location" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="severity">{t("hse.severity")}</Label>
            <select id="severity" name="severity" defaultValue="LOW" className={SELECT_CLASS}>
              {["LOW", "MEDIUM", "HIGH"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}

export function CloseObservationButton({ observationId }: { observationId: string }) {
  const { t } = useI18n();
  return <Button size="sm" variant="secondary" onClick={() => closeObservationAction(observationId)}>{t("hse.close")}</Button>;
}

export function CreateIncidentDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createIncidentAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm" variant="danger"><Plus size={14} /> {t("hse.newIncident")}</Button>} title={t("hse.newIncident")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="classification">{t("hse.category")}</Label>
          <select id="classification" name="classification" defaultValue="NEAR_MISS" className={SELECT_CLASS}>
            {["NEAR_MISS", "FIRST_AID", "MEDICAL_TREATMENT", "LOST_TIME", "FATALITY", "PROPERTY_DAMAGE", "ENVIRONMENTAL"].map((v) => <option key={v} value={v}>{t(`hse.incidentClassification_${v}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="title">{t("hse.hazardTitle")}</Label><Input id="title" name="title" required /></div>
        <div className="space-y-1.5"><Label htmlFor="description">{t("common.description")}</Label><Input id="description" name="description" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="occurredAt">{t("hse.occurredAt")}</Label><Input id="occurredAt" name="occurredAt" type="date" required /></div>
          <div className="space-y-1.5"><Label htmlFor="location">{t("hse.location")}</Label><Input id="location" name="location" /></div>
        </div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" variant="danger" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}

export function IncidentStatusActions({ incidentId, status, canClose }: { incidentId: string; status: string; canClose: boolean }) {
  const { t } = useI18n();
  const next: Record<string, { status: string; labelKey: string }[]> = {
    REPORTED: [{ status: "UNDER_INVESTIGATION", labelKey: "hse.investigate" }, { status: "CLOSED", labelKey: "hse.closeIncident" }],
    UNDER_INVESTIGATION: [{ status: "ACTION_PENDING", labelKey: "hse.newCorrectiveAction" }, { status: "CLOSED", labelKey: "hse.closeIncident" }],
    ACTION_PENDING: [{ status: "CLOSED", labelKey: "hse.closeIncident" }],
  };
  const options = next[status] ?? [];
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.status} size="sm" variant={o.status === "CLOSED" ? "secondary" : "secondary"} disabled={o.status === "CLOSED" && !canClose} onClick={() => transitionIncidentAction(incidentId, o.status)}>
          {t(o.labelKey)}
        </Button>
      ))}
      {!canClose && <p className="w-full text-xs text-ink-faint">{t("hse.closeBlockedByOpenActions")}</p>}
    </div>
  );
}

export function CreateCorrectiveActionForm({ incidentId, inspectionId, owners }: { incidentId?: string; inspectionId?: string; owners: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createCorrectiveActionAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
      {incidentId && <input type="hidden" name="incidentId" value={incidentId} />}
      {inspectionId && <input type="hidden" name="inspectionId" value={inspectionId} />}
      <div className="flex-1 min-w-[10rem] space-y-1.5"><Label htmlFor="caDescription">{t("common.description")}</Label><Input id="caDescription" name="description" required /></div>
      <div className="space-y-1.5">
        <Label htmlFor="ownerId">{t("hse.owner")}</Label>
        <select id="ownerId" name="ownerId" defaultValue="" className={SELECT_CLASS} required>
          <option value="" disabled>{t("hse.owner")}</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="dueDate">{t("hse.dueDate")}</Label><Input id="dueDate" name="dueDate" type="date" /></div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{t("hse.newCorrectiveAction")}</Button>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function CorrectiveActionStatusActions({ actionId, status, incidentId }: { actionId: string; status: string; incidentId?: string }) {
  const { t } = useI18n();
  const next: Record<string, { status: string; labelKey: string }[]> = {
    OPEN: [{ status: "IN_PROGRESS", labelKey: "hse.correctiveActionStatus_IN_PROGRESS" }, { status: "COMPLETED", labelKey: "hse.correctiveActionStatus_COMPLETED" }],
    IN_PROGRESS: [{ status: "COMPLETED", labelKey: "hse.correctiveActionStatus_COMPLETED" }],
  };
  const options = next[status] ?? [];
  if (!options.length) return null;
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <Button key={o.status} size="sm" variant="secondary" onClick={() => transitionCorrectiveActionAction(actionId, o.status, incidentId)}>{t(o.labelKey)}</Button>
      ))}
    </div>
  );
}

export function CreateInductionDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInductionAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("hse.newInduction")}</Button>} title={t("hse.newInduction")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5"><Label htmlFor="workerName">{t("hse.workerName")}</Label><Input id="workerName" name="workerName" required /></div>
        <div className="space-y-1.5"><Label htmlFor="workerCompany">{t("hse.workerCompany")}</Label><Input id="workerCompany" name="workerCompany" /></div>
        <div className="space-y-1.5"><Label htmlFor="topicsCovered">{t("hse.topicsCovered")}</Label><Input id="topicsCovered" name="topicsCovered" /></div>
        <div className="space-y-1.5"><Label htmlFor="expiresAt">{t("hse.expiresAt")}</Label><Input id="expiresAt" name="expiresAt" type="date" /></div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}

export function CreateToolboxTalkDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createToolboxTalkAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm" variant="secondary"><Plus size={14} /> {t("hse.newToolboxTalk")}</Button>} title={t("hse.newToolboxTalk")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5"><Label htmlFor="topic">{t("hse.topic")}</Label><Input id="topic" name="topic" required /></div>
        <div className="space-y-1.5"><Label htmlFor="attendeeCount">{t("hse.attendeeCount")}</Label><Input id="attendeeCount" name="attendeeCount" type="number" min="0" /></div>
        <div className="space-y-1.5"><Label htmlFor="notes">{t("hse.notes")}</Label><Input id="notes" name="notes" /></div>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}

export function AddEmergencyContactDialog({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addEmergencyContactAction, undefined);
  return (
    <DialogShell trigger={<Button size="sm"><Plus size={14} /> {t("hse.newEmergencyContact")}</Button>} title={t("hse.newEmergencyContact")} open={open} onOpenChange={setOpen}>
      <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="projectId">{t("legal.project")}</Label><ProjectSelect projects={projects} /></div>
        <div className="space-y-1.5"><Label htmlFor="name">{t("hse.contactName")}</Label><Input id="name" name="name" required /></div>
        <div className="space-y-1.5"><Label htmlFor="role">{t("hse.contactRole")}</Label><Input id="role" name="role" /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">{t("hse.contactPhone")}</Label><Input id="phone" name="phone" required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="type">{t("hse.contactType")}</Label>
          <select id="type" name="type" defaultValue="OTHER" className={SELECT_CLASS}>
            {["AMBULANCE", "FIRE", "POLICE", "HOSPITAL", "SITE_MANAGER", "CLIENT", "OTHER"].map((v) => <option key={v} value={v}>{t(`hse.contactType_${v}`)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="isPrimary" /> {t("hse.isPrimary")}</label>
        {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
      </form>
    </DialogShell>
  );
}
