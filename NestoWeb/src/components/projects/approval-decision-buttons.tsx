"use client";

import { useTransition } from "react";
import { decideApprovalAction } from "@/app/actions/project-approvals";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ApprovalDecisionButtons({ projectId, approvalId }: { projectId: string; approvalId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => decideApprovalAction(projectId, approvalId, "REJECTED"))}
      >
        {t("approvals.reject")}
      </Button>
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => decideApprovalAction(projectId, approvalId, "APPROVED"))}>
        {t("approvals.approve")}
      </Button>
    </div>
  );
}
