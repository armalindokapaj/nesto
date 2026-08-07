"use client";

import { useActionState, useState } from "react";
import { respondToRfiAction } from "@/app/actions/architecture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function RespondToRfiForm({ rfiId }: { rfiId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(respondToRfiAction, undefined);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("common.reply")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="rfiId" value={rfiId} />
      <Input name="response" placeholder={t("common.reply") ?? "Response"} className="h-8 w-40" />
      <Button type="submit" size="sm" disabled={pending}>
        {t("common.submit")}
      </Button>
      {state && "error" in state && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
