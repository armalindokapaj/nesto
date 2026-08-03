"use client";

import { useTransition } from "react";
import { toggleModuleAction } from "@/app/actions/company-modules";
import { MODULE_LABELS, type ModuleKey } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function ModuleToggleList({ states }: { states: { key: ModuleKey; enabled: boolean }[] }) {
  return (
    <div className="space-y-2">
      {states.map((m) => (
        <ModuleToggleRow key={m.key} moduleKey={m.key} enabled={m.enabled} />
      ))}
    </div>
  );
}

function ModuleToggleRow({ moduleKey, enabled }: { moduleKey: ModuleKey; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm font-medium text-ink">{MODULE_LABELS[moduleKey]}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => toggleModuleAction(moduleKey, !enabled))}
        role="switch"
        aria-checked={enabled}
        aria-label={MODULE_LABELS[moduleKey]}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          enabled ? "bg-gold" : "bg-surface-sunken border border-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
