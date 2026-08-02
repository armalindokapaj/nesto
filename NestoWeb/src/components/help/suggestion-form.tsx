"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitSuggestionAction } from "@/app/actions/help";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function SuggestionForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(submitSuggestionAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const success = state && "success" in state;

  useEffect(() => {
    if (success) formRef.current?.reset();
  }, [success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="message">{t("help.suggestionPlaceholder")}</Label>
        <Textarea id="message" name="message" rows={4} placeholder={t("help.suggestionPlaceholder")} required />
      </div>

      {state && "error" in state && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">{t("help.suggestionSent")}</p>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("help.suggestionSubmit")}
      </Button>
    </form>
  );
}
