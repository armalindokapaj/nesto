"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Check, XCircle, RotateCcw, Ban } from "lucide-react";
import { createWorkflowDefinitionAction, decideWorkItemAction, confirmSourceFinalizationAction, cancelWorkflowAction } from "@/app/actions/workflow-engine";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { ROLES } from "@/lib/constants";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type StageDraft = { name: string; approverRole: string };

export function CreateWorkflowDefinitionDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<StageDraft[]>([{ name: "", approverRole: ROLES[0] }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createWorkflowDefinitionAction({
      key: String(formData.get("key") ?? ""),
      name: String(formData.get("name") ?? ""),
      sourceModule: String(formData.get("sourceModule") ?? ""),
      sourceEntityType: String(formData.get("sourceEntityType") ?? ""),
      stages: stages.filter((s) => s.name.trim()).map((s) => ({ name: s.name, approverRole: s.approverRole })),
    });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setStages([{ name: "", approverRole: ROLES[0] }]);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t("workflow.newDefinition")}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("workflow.newDefinition")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={submit} className="space-y-3.5">
            <div className="space-y-1.5"><Label htmlFor="key">{t("workflow.key")}</Label><Input id="key" name="key" placeholder="HSE_INCIDENT_CLOSURE" required /></div>
            <div className="space-y-1.5"><Label htmlFor="name">{t("common.name")}</Label><Input id="name" name="name" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="sourceModule">{t("workflow.sourceModule")}</Label><Input id="sourceModule" name="sourceModule" placeholder="HSE" required /></div>
              <div className="space-y-1.5"><Label htmlFor="sourceEntityType">{t("workflow.sourceEntityType")}</Label><Input id="sourceEntityType" name="sourceEntityType" placeholder="HseIncident" required /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("workflow.stages")}</Label>
              {stages.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder={t("workflow.stageName")}
                    value={s.name}
                    onChange={(e) => setStages((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                  />
                  <select
                    className={SELECT_CLASS}
                    value={s.approverRole}
                    onChange={(e) => setStages((prev) => prev.map((p, i) => (i === idx ? { ...p, approverRole: e.target.value } : p)))}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {stages.length > 1 && (
                    <button type="button" onClick={() => setStages((prev) => prev.filter((_, i) => i !== idx))} className="text-ink-faint hover:text-danger">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={() => setStages((prev) => [...prev, { name: "", approverRole: ROLES[0] }])}>
                <Plus size={14} /> {t("workflow.addStage")}
              </Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.save")}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DecideWorkItemActions({ stageInstanceId }: { stageInstanceId: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(decision: "APPROVE" | "REJECT" | "RETURN") {
    setPending(decision);
    setError(null);
    const result = await decideWorkItemAction(stageInstanceId, decision, comment || undefined);
    setPending(null);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-2">
      <Input placeholder={t("workflow.commentOptional")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => act("APPROVE")} disabled={!!pending}><Check size={14} /> {t("workflow.approve")}</Button>
        <Button size="sm" variant="secondary" onClick={() => act("RETURN")} disabled={!!pending}><RotateCcw size={14} /> {t("workflow.return")}</Button>
        <Button size="sm" variant="danger" onClick={() => act("REJECT")} disabled={!!pending}><XCircle size={14} /> {t("workflow.reject")}</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ConfirmFinalizationButton({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await confirmSourceFinalizationAction(instanceId);
        setPending(false);
      }}
    >
      {t("workflow.confirmFinalization")}
    </Button>
  );
}

export function CancelWorkflowButton({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await cancelWorkflowAction(instanceId);
        setPending(false);
      }}
    >
      <Ban size={14} /> {t("workflow.cancel")}
    </Button>
  );
}
