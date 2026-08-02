"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Copy, Check } from "lucide-react";
import { createUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ROLES, ROLE_LABELS } from "@/lib/constants";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, undefined);
  const [copied, setCopied] = useState(false);

  const success = state && "success" in state ? state : null;

  function copyCredentials() {
    if (!success) return;
    navigator.clipboard.writeText(`Username: ${success.username}\nTemporary password: ${success.temporaryPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(false);
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> Create User
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">
              {success ? "User created" : "Create User"}
            </Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>

          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">
                Share these one-time credentials securely. The user should change their password on first login.
              </p>
              <div className="rounded-lg border border-border bg-surface-sunken p-3 text-sm space-y-1 font-mono">
                <p>Username: <span className="text-ink font-semibold">{success.username}</span></p>
                <p>Temporary password: <span className="text-ink font-semibold">{success.temporaryPassword}</span></p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={copyCredentials} className="w-full">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy credentials"}
              </Button>
              <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form action={formAction} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" placeholder="Elira Doda" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" placeholder="elira.doda" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="elira@company.com" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" name="department" placeholder="Design Team" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="position">Position</Label>
                  <Input id="position" name="position" placeholder="Architect" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue="ARCHITECT"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {ROLES.filter((r) => r !== "OWNER").map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {state && "error" in state && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  {state.error}
                </p>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating…" : "Create account"}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
