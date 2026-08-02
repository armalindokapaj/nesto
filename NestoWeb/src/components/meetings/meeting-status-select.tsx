"use client";

import { useTransition } from "react";
import { updateMeetingStatusAction } from "@/app/actions/meetings";
import { STATUS_TONE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const STATUSES = ["PLANNED", "HELD", "CANCELLED"] as const;
const STATUS_KEY: Record<(typeof STATUSES)[number], string> = {
  PLANNED: "meetings.planned",
  HELD: "meetings.held",
  CANCELLED: "meetings.cancelled",
};

const TONE_TEXT: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-ink-muted",
};

export function MeetingStatusSelect({ meetingId, status }: { meetingId: string; status: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const tone = STATUS_TONE[status] ?? "neutral";

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateMeetingStatusAction(meetingId, e.target.value))}
      className={cn(
        "h-7 rounded-md border border-border bg-surface pl-2 pr-6 text-xs font-medium focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50",
        TONE_TEXT[tone]
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(STATUS_KEY[s])}
        </option>
      ))}
    </select>
  );
}
