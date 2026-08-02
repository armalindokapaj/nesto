"use client";

import { useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { decideDrawingAction } from "@/app/actions/architecture";
import { Button } from "@/components/ui/button";

export function DrawingDecisionButtons({ drawingId }: { drawingId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => decideDrawingAction(drawingId, "APPROVED"))}
      >
        <Check size={13} /> Approve
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => decideDrawingAction(drawingId, "NEEDS_REVISION"))}
      >
        <RotateCcw size={13} /> Revise
      </Button>
    </div>
  );
}
