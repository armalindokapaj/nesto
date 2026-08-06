"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { registerBimModelAction, addBimModelVersionAction, createBimObjectLinkAction, setBimModelStatusAction } from "@/app/actions/bim";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Project = { id: string; name: string };
type BimActionState = { error?: string; success?: string } | undefined;
type Action = (s: BimActionState, f: FormData) => Promise<BimActionState>;

function Shell({ trigger, title, action, children }: { trigger: React.ReactNode; title: string; action: Action; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3">
            {children}
            {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Save"}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RegisterBimModelDialog({ projects }: { projects: Project[] }) {
  return (
    <Shell trigger={<Button size="sm"><Plus size={14} /> New model</Button>} title="Register BIM model" action={registerBimModelAction}>
      <div className="space-y-1.5"><Label htmlFor="projectId">Project</Label>
        <select id="projectId" name="projectId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
          <option value="">Select project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="name">Model name</Label><Input id="name" name="name" required /></div>
      <div className="space-y-1.5"><Label htmlFor="discipline">Discipline</Label>
        <select id="discipline" name="discipline" defaultValue="ARCHITECTURAL" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
          {["ARCHITECTURAL", "STRUCTURAL", "MEP", "LANDSCAPE", "CIVIL", "OTHER"].map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Input id="description" name="description" /></div>
    </Shell>
  );
}

export function AddBimVersionDialog({ modelId }: { modelId: string }) {
  return (
    <Shell trigger={<Button size="sm" variant="secondary"><Plus size={14} /> New version</Button>} title="Register model version" action={addBimModelVersionAction}>
      <input type="hidden" name="modelId" value={modelId} />
      <div className="space-y-1.5"><Label htmlFor="fileName">File name</Label><Input id="fileName" name="fileName" placeholder="tower-a-structural-r12.ifc" /></div>
      <div className="space-y-1.5"><Label htmlFor="documentId">Documents module reference (optional)</Label><Input id="documentId" name="documentId" placeholder="Document ID in the Documents module" /></div>
      <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" /></div>
      <p className="text-xs text-ink-faint">No live 3D preview in this build — registers the revision and metadata; the source file is stored and versioned by the Documents module.</p>
    </Shell>
  );
}

export function CreateBimLinkDialog({ modelId }: { modelId: string }) {
  return (
    <Shell trigger={<Button size="sm" variant="secondary"><Plus size={14} /> Link record</Button>} title="Link this model to a record" action={createBimObjectLinkAction}>
      <input type="hidden" name="modelId" value={modelId} />
      <div className="space-y-1.5"><Label htmlFor="entityType">Record type</Label>
        <select id="entityType" name="entityType" defaultValue="TASK" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
          {["TASK", "WORK_PACKAGE", "ASSET", "UNIT", "HSE_HAZARD", "DOCUMENT", "OTHER"].map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="entityId">Record ID</Label><Input id="entityId" name="entityId" required /></div>
      <div className="space-y-1.5"><Label htmlFor="objectRef">Element GUID / tag (optional)</Label><Input id="objectRef" name="objectRef" placeholder="Leave blank to link the whole model" /></div>
    </Shell>
  );
}

export function BimModelStatusActions({ modelId, status }: { modelId: string; status: string }) {
  const next: Record<string, string[]> = { DRAFT: ["VALIDATED"], VALIDATED: ["PUBLISHED", "DRAFT"], PUBLISHED: ["ARCHIVED"] };
  const options = next[status] ?? [];
  if (!options.length) return null;
  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => setBimModelStatusAction(modelId, s)}>{s.replaceAll("_", " ")}</Button>
      ))}
    </div>
  );
}
