"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Paperclip } from "lucide-react";
import { createTaskAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

type Props = {
  projectId?: string;
  clientId?: string;
  projects?: { id: string; name: string }[];
  members?: { id: string; displayName: string }[];
};

export function CreateTaskDialog({ projectId, clientId, projects, members }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [attachDocument, setAttachDocument] = useState(false);
  const [state, formAction, pending] = useActionState(createTaskAction, undefined);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAttachDocument(false);
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("projects.newTask")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("projects.newTask")}</Dialog.Title>
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
            {projectId && <input type="hidden" name="projectId" value={projectId} />}
            {clientId && <input type="hidden" name="clientId" value={clientId} />}
            {projects && (
              <div className="space-y-1.5">
                <Label htmlFor="projectId">{t("common.project")}</Label>
                <select
                  id="projectId"
                  name="projectId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("common.none")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("task.title")}</Label>
              <Input id="title" name="title" required />
            </div>
            {members && (
              <div className="space-y-1.5">
                <Label htmlFor="mainResponsibleId">{t("common.assignee")}</Label>
                <select
                  id="mainResponsibleId"
                  name="mainResponsibleId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("task.assignToMe")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="priority">{t("task.priority")}</Label>
              <select
                id="priority"
                name="priority"
                defaultValue="MEDIUM"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="LOW">{t("task.low")}</option>
                <option value="MEDIUM">{t("task.medium")}</option>
                <option value="HIGH">{t("task.high")}</option>
                <option value="CRITICAL">{t("task.critical")}</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={attachDocument}
                onChange={(e) => setAttachDocument(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-gold"
              />
              <Paperclip size={14} /> {t("task.attachDocument")}
            </label>

            {attachDocument && (
              <div className="space-y-3 rounded-lg border border-border bg-surface-sunken/50 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="documentName">{t("documents.name")}</Label>
                  <Input id="documentName" name="documentName" required={attachDocument} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="documentCategory">{t("documents.category")}</Label>
                  <Input id="documentCategory" name="documentCategory" placeholder="General" />
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
