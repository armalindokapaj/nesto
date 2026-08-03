"use client";

import { useActionState, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { createEmployeeAction } from "@/app/actions/hr";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n/locale-provider";

const MAX_PHOTO_BYTES = 700_000; // matches PhotoUploadForm's own cap
const DOCUMENT_CATEGORIES = ["CV", "ID / Passport", "Contract", "Certification", "Other"];

type DocumentRow = { id: number; name: string; category: string; visibility: "COMPANY" | "PRIVATE_HR" };

export function CreateEmployeeDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEmployeeAction, undefined);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const nextRowId = useRef(0);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t("hr_sub.photoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function addDocumentRow() {
    setDocuments((rows) => [...rows, { id: nextRowId.current++, name: "", category: DOCUMENT_CATEGORIES[0], visibility: "COMPANY" }]);
  }
  function updateDocumentRow(id: number, patch: Partial<DocumentRow>) {
    setDocuments((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeDocumentRow(id: number) {
    setDocuments((rows) => rows.filter((r) => r.id !== id));
  }

  function resetForm() {
    setPhotoDataUrl(null);
    setPhotoError(null);
    setDocuments([]);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("hr_sub.newEmployee")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("hr_sub.newEmployee")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
              resetForm();
            }}
            className="space-y-3.5"
          >
            <input type="hidden" name="photoDataUrl" value={photoDataUrl ?? ""} />
            <input type="hidden" name="documents" value={JSON.stringify(documents.filter((d) => d.name.trim()))} />

            <div className="flex items-center gap-3">
              <Avatar name="" color="#1A1D23" size={48} src={photoDataUrl} />
              <div className="space-y-1">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  <Camera size={13} /> {t("hr_sub.changePhoto")}
                </button>
                {photoError && <p className="text-xs text-danger">{photoError}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t("common.name")}</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="position">{t("account.position")}</Label>
                <Input id="position" name="position" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">{t("common.department")}</Label>
                <Input id="department" name="department" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hireDate">{t("hr_sub.hireDate")}</Label>
                <Input id="hireDate" name="hireDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthday">{t("hr_sub.birthday")}</Label>
                <Input id="birthday" name="birthday" type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("account.phone")}</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("hr_sub.attachDocumentsAtCreation")}</Label>
                  <p className="text-xs text-ink-faint mt-0.5">{t("hr_sub.attachDocumentsHint")}</p>
                </div>
                <button
                  type="button"
                  onClick={addDocumentRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-sunken shrink-0"
                >
                  <Plus size={12} /> {t("hr_sub.addDocument")}
                </button>
              </div>
              {documents.map((row) => (
                <div key={row.id} className="flex items-start gap-1.5 rounded-lg border border-border p-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder={t("hr_sub.documentNameField")}
                      value={row.name}
                      onChange={(e) => updateDocumentRow(row.id, { name: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={row.category}
                        onChange={(e) => updateDocumentRow(row.id, { category: e.target.value })}
                        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      >
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.visibility}
                        onChange={(e) => updateDocumentRow(row.id, { visibility: e.target.value as DocumentRow["visibility"] })}
                        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      >
                        <option value="COMPANY">{t("hr_sub.visibilityCompany")}</option>
                        <option value="PRIVATE_HR">{t("hr_sub.visibilityHrOnly")}</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDocumentRow(row.id)}
                    className="mt-1.5 text-ink-faint hover:text-danger"
                    aria-label={t("common.remove")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
