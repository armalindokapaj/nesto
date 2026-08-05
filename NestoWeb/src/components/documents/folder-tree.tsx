"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type FolderNode = {
  id: string;
  name: string;
  documentCount: number;
  children: FolderNode[];
};

// §7 — the quiet folder tree column. Purely a navigation filter: selecting a
// folder narrows the list to documents whose primary or shortcut placement
// is that folder, via the `folderId` query param the page reads server-side.
export function FolderTree({ nodes }: { nodes: FolderNode[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get("folderId");
  const scope = searchParams.get("scope");

  function hrefFor(folderId?: string) {
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope);
    if (folderId) params.set("folderId", folderId);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav className="space-y-0.5 text-sm">
      <Link
        href={hrefFor()}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors",
          !activeFolderId ? "bg-gold/10 font-medium text-gold-deep" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
        )}
      >
        <FolderOpen size={14} className="shrink-0" />
        <span className="truncate">{t("documents.allDocuments")}</span>
      </Link>
      {nodes.map((node) => (
        <FolderRow key={node.id} node={node} depth={0} activeFolderId={activeFolderId} hrefFor={hrefFor} />
      ))}
    </nav>
  );
}

function FolderRow({
  node,
  depth,
  activeFolderId,
  hrefFor,
}: {
  node: FolderNode;
  depth: number;
  activeFolderId: string | null;
  hrefFor: (folderId?: string) => string;
}) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = activeFolderId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg py-1.5 pr-2 transition-colors",
          isActive ? "bg-gold/10 font-medium text-gold-deep" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="shrink-0 text-ink-faint hover:text-ink"
          >
            <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Link href={hrefFor(node.id)} className="flex min-w-0 flex-1 items-center gap-1.5">
          <Folder size={13} className="shrink-0" />
          <span className="truncate">{node.name}</span>
        </Link>
        {node.documentCount > 0 && (
          <span className="shrink-0 text-[11px] text-ink-faint">{node.documentCount}</span>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderRow key={child.id} node={child} depth={depth + 1} activeFolderId={activeFolderId} hrefFor={hrefFor} />
          ))}
        </div>
      )}
    </div>
  );
}
