"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCircle2, Clock, FileWarning, ShieldAlert, XCircle } from "lucide-react";
import { logoutPublicAction } from "@/app/actions/public-signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { PublicAccountFull } from "@/server/public-signup";

const EDITABLE_STATUSES = ["PROFILE_INCOMPLETE", "READY_TO_SUBMIT", "CHANGES_REQUESTED", "RESUBMITTED"];

const STATUS_ICON: Record<string, typeof Clock> = {
  PENDING_PLATFORM_REVIEW: Clock,
  RESUBMITTED: Clock,
  CHANGES_REQUESTED: FileWarning,
  APPROVED: CheckCircle2,
  APPROVED_WITH_RESTRICTIONS: ShieldAlert,
  REJECTED: XCircle,
  SUSPENDED: ShieldAlert,
};

export function PendingDashboard({
  account,
  completion,
}: {
  account: PublicAccountFull;
  completion: { percentage: number; missing: string[] };
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const StatusIcon = STATUS_ICON[account.status] ?? Clock;
  const latestReview = account.application?.reviews[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl text-ink">{t("apply.pendingTitle")}</h1>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => startTransition(() => logoutPublicAction())}>
          {t("common.signOut")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-start gap-3">
          <StatusIcon size={22} className="text-gold shrink-0 mt-0.5" />
          <div>
            <Badge status={account.status}>{t(`apply.status.${account.status}`)}</Badge>
            <p className="mt-2 text-sm text-ink-muted">{t(`apply.statusExplain.${account.status}`)}</p>
            {account.application && (
              <p className="mt-1 text-xs text-ink-faint">
                {t("apply.applicationNumber")}: {account.application.applicationNumber} — {t("apply.submittedOn")} {formatDate(account.application.submittedAt)}
              </p>
            )}
            {account.application?.approvedProfileNumber && (
              <p className="mt-1 text-xs text-ink-faint">{t("apply.profileNumber")}: {account.application.approvedProfileNumber}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {latestReview?.reason && (account.status === "CHANGES_REQUESTED" || account.status === "REJECTED" || account.status === "SUSPENDED") && (
        <Card>
          <CardHeader><CardTitle>{t("apply.reviewerMessage")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-ink-muted">{latestReview.reason}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("apply.completionTitle")}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken mb-2">
            <div className="h-full bg-gold" style={{ width: `${completion.percentage}%` }} />
          </div>
          <p className="text-xs text-ink-muted">{completion.percentage}% {t("apply.complete")}</p>
          {EDITABLE_STATUSES.includes(account.status) && (
            <Link href="/apply/onboarding">
              <Button size="sm" className="mt-3">{t("apply.continueEditing")}</Button>
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("apply.submissionHistory")}</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l border-border pl-4">
            {account.auditEvents.map((ev) => (
              <li key={ev.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gold" />
                <p className="text-ink">{ev.summary}</p>
                <p className="text-xs text-ink-faint">{formatDate(ev.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
