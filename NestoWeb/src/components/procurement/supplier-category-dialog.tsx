"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FolderTree, X } from "lucide-react";
import { createSupplierCategoryAction, setSupplierCategoryActiveAction } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Category = { id: string; code: string; name: string; description: string | null; active: boolean; _count: { suppliers: number } };

export function SupplierCategoryDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSupplierCategoryAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary"><FolderTree size={14} /> Categories</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">Supplier categories</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <div className="mb-5 space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{c.code} · {c.name}</p>
                  <p className="text-xs text-ink-faint">{c._count.suppliers} supplier(s){c.description ? ` · ${c.description}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={c.active ? "ACTIVE" : "INACTIVE"}>{c.active ? "Active" : "Inactive"}</Badge>
                  <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={() => setSupplierCategoryActiveAction(c.id, !c.active)}>{c.active ? "Deactivate" : "Activate"}</button>
                </div>
              </div>
            ))}
            {!categories.length && <p className="py-4 text-center text-xs text-ink-faint">No categories defined yet.</p>}
          </div>
          <form action={formAction} className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="code">Code</Label><Input id="code" name="code" placeholder="STEEL" required /></div>
              <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" placeholder="Structural steel" required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Input id="description" name="description" /></div>
            {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Add category"}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
