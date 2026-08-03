"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewApplicationAction } from "@/app/actions/public-signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import type { ApplicationReviewAction } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// §14 — every decision is a dedicated typed action, never a plain comment.
const ACTIONS_BY_STATUS: Record<string, ApplicationReviewAction[]> = {
  PENDING_PLATFORM_REVIEW: ["APPROVE", "APPROVE_WITH_RESTRICTIONS", "REQUEST_CHANGES", "REQUEST_DOCUMENTS", "REJECT"],
  RESUBMITTED: ["APPROVE", "APPROVE_WITH_RESTRICTIONS", "REQUEST_CHANGES", "REQUEST_DOCUMENTS", "REJECT"],
  APPROVED: ["SUSPEND"],
  APPROVED_WITH_RESTRICTIONS: ["SUSPEND"],
  SUSPENDED: ["REACTIVATE"],
};

const REASON_REQUIRED: ApplicationReviewAction[] = ["REQUEST_CHANGES", "REQUEST_DOCUMENTS", "REJECT", "SUSPEND"];

export function ReviewActionPanel({ publicAccountId, status }: { publicAccountId: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(reviewApplicationAction, undefined);
  const [action, setAction] = useState<ApplicationReviewAction | null>(null);
  const [reason, setReason] = useState("");

  const actions = ACTIONS_BY_STATUS[status] ?? [];
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("platform.reviewDecision")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a} size="sm" variant={a === action ? "primary" : "secondary"} onClick={() => setAction(a)}>
              {t(`platform.action.${a}`)}
            </Button>
          ))}
        </div>

        {action && (
          <form
            action={async (formData) => {
              await formAction(formData);
              router.refresh();
            }}
            className="space-y-3"
          >
            <input type="hidden" name="publicAccountId" value={publicAccountId} />
            <input type="hidden" name="action" value={action} />
            <Textarea
              name="reason"
              rows={2}
              placeholder={REASON_REQUIRED.includes(action) ? t("platform.reasonRequired") : t("platform.reasonOptional")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={REASON_REQUIRED.includes(action)}
            />
            {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("common.saving") : t("platform.confirmDecision")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
