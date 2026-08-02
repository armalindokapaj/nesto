"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Paperclip, Trash2 } from "lucide-react";
import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateProjectDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [documentRows, setDocumentRows] = useState<number[]>([]);
  const [nextRowId, setNextRowId] = useState(0);
  const [state, formAction, pending] = useActionState(createProjectAction, undefined);

  function addDocumentRow() {
    setDocumentRows((rows) => [...rows, nextRowId]);
    setNextRowId((id) => id + 1);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDocumentRows([]);
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("projects.newProject")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("projects.newProject")}</Dialog.Title>
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
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("projects.createProjectName")}</Label>
              <Input id="name" name="name" placeholder="Riverside Towers" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">{t("projects.client")}</Label>
                <Input id="clientName" name="clientName" placeholder="Riverside Holdings" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">{t("projects.location")}</Label>
                <Input id="location" name="location" placeholder="Tirana, Albania" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">{t("projects.budgetEur")}</Label>
              <Input id="budget" name="budget" type="number" placeholder="2500000" />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Paperclip size={14} /> {t("projects.attachDocuments")}
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={addDocumentRow}>
                  <Plus size={13} /> {t("projects.addDocument")}
                </Button>
              </div>
              {documentRows.length === 0 ? (
                <p className="text-xs text-ink-faint">{t("projects.noDocumentsAttached")}</p>
              ) : (
                <div className="space-y-2">
                  {documentRows.map((rowId) => (
                    <div key={rowId} className="flex items-center gap-2">
                      <Input name="documentName" placeholder={t("documents.name")} className="flex-1" />
                      <Input name="documentCategory" placeholder={t("documents.category")} className="w-32" />
                      <button
                        type="button"
                        onClick={() => setDocumentRows((rows) => rows.filter((id) => id !== rowId))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-danger-soft hover:text-danger"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
