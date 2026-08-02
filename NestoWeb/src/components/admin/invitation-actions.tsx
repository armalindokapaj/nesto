"use client";

import { useTransition } from "react";
import { revokeInvitationAction, resendInvitationAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => resendInvitationAction(invitationId))}
      >
        {t("common.resend")}
      </Button>
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => revokeInvitationAction(invitationId))}
      >
        {t("common.revoke")}
      </Button>
    </div>
  );
}
