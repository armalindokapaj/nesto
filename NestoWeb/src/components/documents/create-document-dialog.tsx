"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createDocumentAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TASK_FILE_CATEGORIES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Props = {
  projects?: { id: string; name: string }[];
  projectId?: string;
  clientId?: string;
  taskId?: string;
  triggerLabel?: string;
};

export function CreateDocumentDialog({ projects, projectId, clientId, taskId, triggerLabel }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createDocumentAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {triggerLabel ?? t("documents.newDocument")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{triggerLabel ?? t("documents.newDocument")}</Dialog.Title>
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
            {clientId && <input type="hidden" name="clientId" value={clientId} />}
            {projectId && <input type="hidden" name="projectId" value={projectId} />}
            {taskId && <input type="hidden" name="taskId" value={taskId} />}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("documents.name")}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t("documents.category")}</Label>
              {taskId ? (
                <select
                  id="category"
                  name="category"
                  defaultValue={TASK_FILE_CATEGORIES[0]}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {TASK_FILE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <Input id="category" name="category" placeholder="General" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">{t("documents.file")}</Label>
              <input
                id="file"
                name="file"
                type="file"
                required
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-border"
              />
            </div>
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
