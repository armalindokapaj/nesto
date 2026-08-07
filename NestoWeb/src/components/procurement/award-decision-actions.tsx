"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideAwardAction } from "@/app/actions/procurement-comparison";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// §10.3 Separation of duties — server rejects the preparer deciding their
// own recommendation; this UI is shown to any FULL-authority user but
// surfaces that rejection as an error if they were also the preparer.
export function AwardDecisionActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      try {
        await decideAwardAction(id, decision, note || undefined);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not decide.");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-ink">Decision</p>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (optional)" />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={isPending} onClick={() => decide("APPROVED")}>Approve</Button>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => decide("REJECTED")}>Reject</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
