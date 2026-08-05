"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toggleConfigNodeAction, clearConfigOverrideAction } from "@/app/actions/platform-config";
import type { ConfigLevel } from "@/lib/platform-config";
import { cn } from "@/lib/utils";

export type ConfigNodeState = {
  key: string;
  label: string;
  level: ConfigLevel;
  parent?: string;
  route?: string;
  enabled: boolean;
  explicitlySet: boolean;
  /** Off only because an ancestor is off — shown as inherited, not as a choice. */
  inheritedOff: boolean;
  depth: number;
};

const LEVEL_STYLES: Record<ConfigLevel, string> = {
  MODULE: "bg-gold/10 text-gold-deep border-gold/30",
  PAGE: "bg-surface-sunken text-ink-muted border-border",
  SECTION: "bg-surface-sunken text-ink-muted border-border",
  WIDGET: "bg-surface-sunken text-ink-faint border-border",
  FEATURE: "bg-surface-sunken text-ink-muted border-border",
  WORKFLOW: "bg-surface-sunken text-ink-muted border-border",
  ACTION: "bg-surface-sunken text-ink-faint border-border",
  REPORT: "bg-surface-sunken text-ink-faint border-border",
};

export function ConfigNodeTree({ nodes }: { nodes: ConfigNodeState[] }) {
  return (
    <div className="divide-y divide-border">
      {nodes.map((node) => (
        <ConfigNodeRow key={node.key} node={node} />
      ))}
    </div>
  );
}

function ConfigNodeRow({ node }: { node: ConfigNodeState }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors",
        node.inheritedOff && "opacity-55"
      )}
      style={{ paddingLeft: `${12 + node.depth * 18}px` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm", node.level === "MODULE" ? "font-semibold text-ink" : "text-ink")}>
            {node.label}
          </span>
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
              LEVEL_STYLES[node.level]
            )}
          >
            {node.level.toLowerCase()}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint">{node.key}</p>
      </div>

      {node.inheritedOff ? (
        // Explains *why* it is off, so an admin doesn't try to switch on a
        // child whose parent is the thing actually blocking it.
        <span className="shrink-0 text-xs text-ink-faint">off via parent</span>
      ) : (
        node.explicitlySet && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => clearConfigOverrideAction(node.key))}
            title="Reset to inherited"
            aria-label={`Reset ${node.label} to inherited`}
            className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
          >
            <RotateCcw size={13} />
          </button>
        )
      )}

      <button
        type="button"
        disabled={isPending || node.inheritedOff}
        onClick={() => startTransition(() => toggleConfigNodeAction(node.key, !node.enabled))}
        role="switch"
        aria-checked={node.enabled}
        aria-label={node.label}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          node.enabled ? "bg-gold" : "bg-surface-sunken border border-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            node.enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
