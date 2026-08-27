"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ShieldCheck } from "lucide-react";
import { setMemberAccessModeAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ASSIGNABLE_ACCESS_MODES, ACCESS_MODE_LABELS, ACCESS_MODE_DESCRIPTIONS } from "@/lib/constants";
import type { AssignableAccessMode } from "@/lib/constants";

// Phase 18 — the write half of access revocation. `dal.ts` has always blocked
// SUSPENDED/ARCHIVED members on every request; until this dialog existed there
// was no way to put anyone into either state.
export function MemberAccessDialog({
  userId,
  displayName,
  currentMode,
  isSelf,
}: {
  userId: string;
  displayName: string;
  currentMode: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssignableAccessMode>(
    (ASSIGNABLE_ACCESS_MODES as readonly string[]).includes(currentMode) ? (currentMode as AssignableAccessMode) : "STANDARD",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // An admin suspending themselves would be locked out with no way back in,
  // so the server refuses it too — this just avoids offering the dead control.
  if (isSelf) return null;

  const revoking = mode !== "STANDARD";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setReason("");
          setMode((ASSIGNABLE_ACCESS_MODES as readonly string[]).includes(currentMode) ? (currentMode as AssignableAccessMode) : "STANDARD");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="ghost">
          <ShieldCheck size={14} /> Access
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <Dialog.Title className="text-base font-semibold text-ink">Manage access</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-ink-muted mb-4">{displayName}</Dialog.Description>

          <div className="space-y-2">
            {ASSIGNABLE_ACCESS_MODES.map((m) => (
              <label
                key={m}
                className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${
                  mode === m ? "border-gold bg-surface-sunken" : "border-border hover:border-border-strong"
                }`}
              >
                <input
                  type="radio"
                  name="accessMode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="mt-1 accent-gold"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{ACCESS_MODE_LABELS[m]}</span>
                  <span className="block text-xs text-ink-muted">{ACCESS_MODE_DESCRIPTIONS[m]}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <Label htmlFor="access-reason">Reason {revoking ? "" : "(optional)"}</Label>
            <Input
              id="access-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={revoking ? "Why is access being removed?" : "Why is access being restored?"}
            />
            <p className="mt-1 text-xs text-ink-faint">Recorded on the audit trail.</p>
          </div>

          {revoking && (
            <p className="mt-4 rounded-lg border border-border bg-surface-sunken p-3 text-xs text-ink-muted">
              {displayName} will be signed out on their next request and will not be able to sign in again until access
              is restored.
            </p>
          )}

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              size="sm"
              variant={revoking ? "danger" : "primary"}
              disabled={pending || mode === currentMode}
              onClick={() =>
                startTransition(async () => {
                  const result = await setMemberAccessModeAction(userId, mode, reason || undefined);
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                })
              }
            >
              {pending ? "Saving…" : revoking ? `Set to ${ACCESS_MODE_LABELS[mode]}` : "Restore access"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
