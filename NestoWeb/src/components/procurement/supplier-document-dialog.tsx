"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { addSupplierDocumentAction } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AddSupplierDocumentDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addSupplierDocumentAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary"><Plus size={14} /> Document</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">Attach supplier document</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="supplierId" value={supplierId} />
            <div className="space-y-1.5"><Label htmlFor="title">Title</Label><Input id="title" name="title" placeholder="ISO 9001 certificate" required /></div>
            <div className="space-y-1.5"><Label htmlFor="type">Type</Label><select id="type" name="type" defaultValue="OTHER" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"><option value="REGISTRATION">Registration</option><option value="INSURANCE">Insurance</option><option value="TAX_CERTIFICATE">Tax certificate</option><option value="ISO_CERTIFICATE">ISO certificate</option><option value="LICENSE">License</option><option value="OTHER">Other</option></select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="issuedAt">Issued</Label><Input id="issuedAt" name="issuedAt" type="date" /></div>
              <div className="space-y-1.5"><Label htmlFor="expiresAt">Expires</Label><Input id="expiresAt" name="expiresAt" type="date" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="url">Reference URL</Label><Input id="url" name="url" /></div>
            {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Attach document"}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
