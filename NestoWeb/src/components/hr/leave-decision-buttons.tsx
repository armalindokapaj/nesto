"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideLeaveRequestAction } from "@/app/actions/hr";

export function LeaveDecisionButtons({ leaveRequestId }: { leaveRequestId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <button
        disabled={pending}
        onClick={() => startTransition(() => decideLeaveRequestAction(leaveRequestId, "APPROVED"))}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-success-soft text-success hover:opacity-80 disabled:opacity-50"
        aria-label="Approve"
      >
        <Check size={14} />
      </button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => decideLeaveRequestAction(leaveRequestId, "REJECTED"))}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-danger-soft text-danger hover:opacity-80 disabled:opacity-50"
        aria-label="Reject"
      >
        <X size={14} />
      </button>
    </div>
  );
}
