"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { updateEmployeePhotoAction } from "@/app/actions/employee-profile";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n/locale-provider";

const MAX_BYTES = 700_000;

export function PhotoUploadForm({
  employeeId,
  fullName,
  avatarColor,
  photoDataUrl,
}: {
  employeeId: string;
  fullName: string;
  avatarColor: string;
  photoDataUrl: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateEmployeePhotoAction, undefined);
  const [preview, setPreview] = useState<string | null>(photoDataUrl);
  const [pickedDataUrl, setPickedDataUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPickError(null);
    if (file.size > MAX_BYTES) {
      setPickError(t("hr_sub.photoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setPickedDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="flex items-center gap-4">
      <Avatar name={fullName} color={avatarColor} size={64} src={preview} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="photoDataUrl" value={pickedDataUrl ?? ""} />
      <div className="space-y-1.5">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken"
          >
            <Camera size={13} /> {t("hr_sub.changePhoto")}
          </button>
          {photoDataUrl && !pickedDataUrl && (
            <button
              type="submit"
              name="remove"
              value="1"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
            >
              <Trash2 size={13} /> {t("common.remove")}
            </button>
          )}
          {pickedDataUrl && (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gold-strong disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          )}
        </div>
        {pickError && <p className="text-xs text-danger">{pickError}</p>}
        {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
