"use client";

import { useActionState, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Trash2, FileText, Lock } from "lucide-react";
import { addEmployeeDocumentAction, removeEmployeeDocumentAction } from "@/app/actions/employee-profile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Doc = {
  id: string;
  name: string;
  category: string;
  visibility: string;
  createdAt: string | Date;
  uploadedBy: { displayName: string };
};

type Category = "CV" | "CERTIFICATION" | "WORK_CONTRACT";

function AddDocumentDialog({ employeeId, categories }: { employeeId: string; categories: Category[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addEmployeeDocumentAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Plus size={14} /> {t("hr_sub.addDocument")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("hr_sub.addDocument")}</Dialog.Title>
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
            <input type="hidden" name="employeeId" value={employeeId} />
            <div className="space-y-1.5">
              <Label htmlFor="category">{t("documents.category")}</Label>
              <select
                id="category"
                name="category"
                defaultValue={categories[0]}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {t(`hr_sub.documentCategory_${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("documents.name")}</Label>
              <Input id="name" name="name" required />
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

function DocRow({ doc, employeeId, canDelete }: { doc: Doc; employeeId: string; canDelete: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {doc.visibility === "PRIVATE_HR" ? (
          <Lock size={15} className="text-ink-faint shrink-0" />
        ) : (
          <FileText size={15} className="text-ink-faint shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
          <p className="text-xs text-ink-muted">
            {t(`hr_sub.documentCategory_${doc.category}`)} · {doc.uploadedBy.displayName} · {formatDate(doc.createdAt)}
          </p>
        </div>
      </div>
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => removeEmployeeDocumentAction(doc.id, employeeId))}
          className="shrink-0 text-ink-faint hover:text-danger disabled:opacity-50"
          aria-label={t("common.delete")}
        >
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}

export function EmployeeDocuments({
  employeeId,
  documents,
  canManage,
  mode,
}: {
  employeeId: string;
  documents: Doc[];
  canManage: boolean;
  mode: "general" | "contract";
}) {
  const { t } = useI18n();
  const categories: Category[] = mode === "contract" ? ["WORK_CONTRACT"] : ["CV", "CERTIFICATION"];

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <AddDocumentDialog employeeId={employeeId} categories={categories} />
        </div>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-ink-faint text-center py-6">{t("hr_sub.noDocuments")}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} employeeId={employeeId} canDelete={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}
