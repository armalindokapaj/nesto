"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrderFromAwardAction } from "@/app/actions/procurement-comparison";
import { Button } from "@/components/ui/button";

export function CreatePoFromAwardButton({ awardId }: { awardId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const order = await createPurchaseOrderFromAwardAction(awardId);
              router.push(`/dashboard/procurement/orders/${order.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create purchase order.");
            }
          })
        }
      >
        {isPending ? "Creating…" : "Create Purchase Order"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
