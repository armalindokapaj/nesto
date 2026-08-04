"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createApprovalAction } from "@/app/actions/project-approvals";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

type Member = { id: string; displayName: string };
type Doc = { id: string; name: string };

export function CreateApprovalDialog({ projectId, members, documents }: { projectId: string; members: Member[]; documents: Doc[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createApprovalAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("approvals.newApproval")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("approvals.newApproval")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-1.5">
              <Label htmlFor="apTitle">{t("approvals.title")}</Label>
              <Input id="apTitle" name="title" placeholder={t("approvals.titlePlaceholder")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apDescription">{t("common.description")}</Label>
              <Input id="apDescription" name="description" placeholder={t("approvals.descriptionPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="apDepartment">{t("common.department")}</Label>
                <Input id="apDepartment" name="department" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apRelated">{t("approvals.relatedEntity")}</Label>
                <Input id="apRelated" name="relatedEntity" placeholder={t("approvals.relatedEntityPlaceholder")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apOptions">{t("approvals.optionsProposed")}</Label>
              <Input id="apOptions" name="optionsProposed" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="apCost">{t("approvals.costImpact")}</Label>
                <Input id="apCost" name="costImpact" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apTimeline">{t("approvals.timelineImpact")}</Label>
                <Input id="apTimeline" name="timelineImpact" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apTechnical">{t("approvals.technicalImpact")}</Label>
                <Input id="apTechnical" name="technicalImpact" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="apApprover">{t("approvals.approver")}</Label>
                <select
                  id="apApprover"
                  name="approverId"
                  defaultValue=""
                  required
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="" disabled>
                    {t("common.select")}
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apDeadline">{t("approvals.deadline")}</Label>
                <Input id="apDeadline" name="deadline" type="date" />
              </div>
            </div>
            {documents.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("approvals.attachments")}</Label>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {documents.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs text-ink-muted">
                      <input type="checkbox" name="attachmentIds" value={d.id} className="rounded border-border-strong accent-gold" />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.creating") : t("common.create")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
