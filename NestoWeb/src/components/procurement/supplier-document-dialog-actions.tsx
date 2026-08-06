"use client";

import { useState } from "react";
import { markSupplierDocumentRenewalRequiredAction } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";

export function MarkRenewalRequiredButton({ documentId }: { documentId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await markSupplierDocumentRenewalRequiredAction(documentId);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Flagging…" : "Flag renewal"}
    </Button>
  );
}
