"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  activateDepartmentAction,
  requestInvolvementAction,
  linkContractAction,
  assignContractorAction,
  recordInspectionAction,
  explainDelayAction,
  escalateAction,
  completeTaskAction,
  reopenTaskAction,
  type ActionState,
} from "@/app/actions/task-orchestration";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DEPARTMENT_ROLES, DEPARTMENT_LABELS, CONTRACT_LINK_DECISIONS, INSPECTION_RESULTS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Member = { id: string; displayName: string };
type Contractor = { id: string; name: string; tradeType: string };
type Contract = { id: string; number: string; title: string };

// Shared dialog chrome — every orchestration dialog here follows the same
// shape (trigger button -> form -> submit via useTransition -> router.refresh
// on success, since these Server Components don't use useActionState/FormData;
// task-orchestration.ts's actions take typed args, not FormData).
function ActionDialog({
  trigger,
  title,
  children,
  onSubmit,
  submitLabel,
  canSubmit = true,
}: {
  trigger: ReactNode;
  title: string;
  children: (helpers: { pending: boolean; error: string | null }) => ReactNode;
  onSubmit: () => Promise<ActionState>;
  submitLabel: string;
  canSubmit?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    startTransition(async () => {
      const result = await onSubmit();
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="space-y-3.5">
            {children({ pending, error })}
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button className="w-full" disabled={pending || !canSubmit} onClick={handleSubmit}>
              {pending ? t("common.saving") : submitLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ActivateDepartmentDialog({ taskId, members, trigger }: { taskId: string; members: Member[]; trigger: ReactNode }) {
  const { t } = useI18n();
  const [department, setDepartment] = useState<(typeof DEPARTMENT_ROLES)[number]>(DEPARTMENT_ROLES[0]);
  const [ownerId, setOwnerId] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [deadline, setDeadline] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.activateDepartment")}
      submitLabel={t("common.create")}
      canSubmit={!!ownerId && requiredAction.length > 1}
      onSubmit={() =>
        activateDepartmentAction({
          taskId,
          department,
          ownerId,
          requiredAction,
          expectedOutput: expectedOutput || undefined,
          deadline: deadline ? new Date(deadline) : undefined,
          requiresApproval,
          isMandatory: true,
        })
      }
    >
      {() => (
        <>
          <Field label={t("orchestration.department")}>
            <select value={department} onChange={(e) => setDepartment(e.target.value as (typeof DEPARTMENT_ROLES)[number])} className={selectClass}>
              {DEPARTMENT_ROLES.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orchestration.accountableOwner")}>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={selectClass}>
              <option value="">{t("common.select")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orchestration.requiredAction")}>
            <Input value={requiredAction} onChange={(e) => setRequiredAction(e.target.value)} required />
          </Field>
          <Field label={t("orchestration.expectedOutput")}>
            <Input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} />
          </Field>
          <Field label={t("common.dueDate")}>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="accent-gold" />
            {t("orchestration.requiresApproval")}
          </label>
        </>
      )}
    </ActionDialog>
  );
}

export function RequestInvolvementDialog({ taskId, trigger }: { taskId: string; trigger: ReactNode }) {
  const { t } = useI18n();
  const [department, setDepartment] = useState<(typeof DEPARTMENT_ROLES)[number]>(DEPARTMENT_ROLES[0]);
  const [reason, setReason] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.requestInvolvement")}
      submitLabel={t("orchestration.send")}
      canSubmit={reason.length > 1}
      onSubmit={() => requestInvolvementAction({ taskId, department, reason, shouldBlock: true })}
    >
      {() => (
        <>
          <Field label={t("orchestration.department")}>
            <select value={department} onChange={(e) => setDepartment(e.target.value as (typeof DEPARTMENT_ROLES)[number])} className={selectClass}>
              {DEPARTMENT_ROLES.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orchestration.reason")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function LinkContractDialog({ taskId, contracts, trigger }: { taskId: string; contracts: Contract[]; trigger: ReactNode }) {
  const { t } = useI18n();
  const [decision, setDecision] = useState<(typeof CONTRACT_LINK_DECISIONS)[number]>("EXISTING_CONTRACT");
  const [contractId, setContractId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.legalDecision")}
      submitLabel={t("common.save")}
      onSubmit={() => linkContractAction({ taskId, decision, contractId: contractId || undefined, reason: reason || undefined })}
    >
      {() => (
        <>
          <Field label={t("orchestration.decision")}>
            <select value={decision} onChange={(e) => setDecision(e.target.value as (typeof CONTRACT_LINK_DECISIONS)[number])} className={selectClass}>
              {CONTRACT_LINK_DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          {(decision === "EXISTING_CONTRACT" || decision === "VARIATION_REQUIRED") && (
            <Field label={t("nav.contracts")}>
              <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={selectClass}>
                <option value="">{t("common.none")}</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} — {c.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("orchestration.reason")}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function AssignContractorDialog({
  taskId,
  contractors,
  contracts,
  trigger,
}: {
  taskId: string;
  contractors: Contractor[];
  contracts: Contract[];
  trigger: ReactNode;
}) {
  const { t } = useI18n();
  const [contractorId, setContractorId] = useState("");
  const [contractId, setContractId] = useState("");
  const [scope, setScope] = useState("");
  const [deadline, setDeadline] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.assignContractor")}
      submitLabel={t("common.create")}
      canSubmit={!!contractorId && scope.length > 1}
      onSubmit={() => assignContractorAction({ taskId, contractorId, contractId: contractId || undefined, scope, deadline: deadline ? new Date(deadline) : undefined })}
    >
      {() => (
        <>
          <Field label={t("nav.contractors")}>
            <select value={contractorId} onChange={(e) => setContractorId(e.target.value)} className={selectClass}>
              <option value="">{t("common.select")}</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.tradeType}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("nav.contracts")}>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={selectClass}>
              <option value="">{t("common.none")}</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number} — {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orchestration.scope")}>
            <Textarea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} />
          </Field>
          <Field label={t("common.dueDate")}>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function RecordInspectionDialog({
  taskId,
  inspectionId,
  trigger,
}: {
  taskId: string;
  inspectionId?: string;
  trigger: ReactNode;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<(typeof INSPECTION_RESULTS)[number]>("PASSED");
  const [notes, setNotes] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.recordInspection")}
      submitLabel={t("common.save")}
      onSubmit={() => recordInspectionAction({ taskId, inspectionId, result, notes: notes || undefined })}
    >
      {() => (
        <>
          <Field label={t("orchestration.result")}>
            <select value={result} onChange={(e) => setResult(e.target.value as (typeof INSPECTION_RESULTS)[number])} className={selectClass}>
              {INSPECTION_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("common.notes")}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function ExplainDelayDialog({ taskId, trigger }: { taskId: string; trigger: ReactNode }) {
  const { t } = useI18n();
  const [cause, setCause] = useState("");
  const [progressPct, setProgressPct] = useState("0");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.explainDelay")}
      submitLabel={t("common.save")}
      canSubmit={cause.length > 1 && !!newExpectedDate}
      onSubmit={() =>
        explainDelayAction({
          taskId,
          cause,
          progressPct: Number(progressPct),
          newExpectedDate: new Date(newExpectedDate),
          correctiveAction: correctiveAction || undefined,
        })
      }
    >
      {() => (
        <>
          <Field label={t("orchestration.cause")}>
            <Textarea rows={2} value={cause} onChange={(e) => setCause(e.target.value)} />
          </Field>
          <Field label={t("orchestration.progressPct")}>
            <Input type="number" min={0} max={100} value={progressPct} onChange={(e) => setProgressPct(e.target.value)} />
          </Field>
          <Field label={t("orchestration.newExpectedDate")}>
            <Input type="date" value={newExpectedDate} onChange={(e) => setNewExpectedDate(e.target.value)} />
          </Field>
          <Field label={t("orchestration.correctiveAction")}>
            <Textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function EscalateDialog({ taskId, members, trigger }: { taskId: string; members: Member[]; trigger: ReactNode }) {
  const { t } = useI18n();
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.escalate")}
      submitLabel={t("orchestration.escalate")}
      canSubmit={!!toUserId && reason.length > 1}
      onSubmit={() => escalateAction({ taskId, toUserId, reason })}
    >
      {() => (
        <>
          <Field label={t("orchestration.escalateTo")}>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className={selectClass}>
              <option value="">{t("common.select")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orchestration.reason")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function CompleteTaskDialog({
  taskId,
  blockers,
  trigger,
}: {
  taskId: string;
  blockers: string[];
  trigger: ReactNode;
}) {
  const { t } = useI18n();
  const [comment, setComment] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.completeTask")}
      submitLabel={t("orchestration.completeTask")}
      canSubmit={blockers.length === 0 && comment.length > 1}
      onSubmit={() => completeTaskAction({ taskId, comment })}
    >
      {() => (
        <>
          {blockers.length > 0 ? (
            <div className="rounded-lg bg-danger-soft p-3 space-y-1">
              <p className="text-xs font-semibold text-danger">{t("orchestration.outstandingGates")}</p>
              <ul className="text-xs text-danger list-disc pl-4 space-y-0.5">
                {blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Field label={t("orchestration.completionComment")}>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          )}
        </>
      )}
    </ActionDialog>
  );
}

export function ReopenTaskDialog({ taskId, trigger }: { taskId: string; trigger: ReactNode }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [newIssue, setNewIssue] = useState("");

  return (
    <ActionDialog
      trigger={trigger}
      title={t("orchestration.reopenTask")}
      submitLabel={t("orchestration.reopenTask")}
      canSubmit={reason.length > 1}
      onSubmit={() => reopenTaskAction({ taskId, reason, newIssue: newIssue || undefined })}
    >
      {() => (
        <>
          <Field label={t("orchestration.reason")}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t("orchestration.newIssue")}>
            <Textarea rows={2} value={newIssue} onChange={(e) => setNewIssue(e.target.value)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

// Wraps the control inside the <label> (implicit association) rather than a
// separate htmlFor/id pair, so every field here is reachable by assistive
// tech and by getByLabel() without threading unique ids through each caller.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
