"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { retryDomainEventAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function RetryDomainEventButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await retryDomainEventAction(eventId);
            setError("error" in result ? result.error : null);
          })
        }
      >
        <RefreshCw size={14} /> {pending ? "Retrying…" : "Retry"}
      </Button>
      {error && <p className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
