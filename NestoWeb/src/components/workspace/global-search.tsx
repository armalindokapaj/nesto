"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, FolderKanban, CheckSquare, FileText, Contact, Handshake, UserCog, ScrollText, Truck, ShieldAlert, BookText } from "lucide-react";
import type { SearchResult } from "@/server/search";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const ICON = {
  project: FolderKanban,
  task: CheckSquare,
  invoice: FileText,
  employee: Contact,
  client: Handshake,
  contractor: UserCog,
  contract: ScrollText,
  supplier: Truck,
  purchaseOrder: Truck,
  hseReport: ShieldAlert,
  document: BookText,
} as const;

export function GlobalSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  // Derived at render time rather than reset via setState-in-effect above —
  // avoids an extra render pass just to clear stale results.
  const visibleResults = query.trim().length < 2 ? [] : results;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("common.search")}
          className="h-9 w-full rounded-lg border border-border bg-surface-sunken pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-surface transition-colors"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-surface shadow-lg overflow-hidden z-40">
          {loading && <p className="px-4 py-3 text-xs text-ink-muted">{t("common.searching")}</p>}
          {!loading && visibleResults.length === 0 && (
            <p className="px-4 py-3 text-xs text-ink-muted">{t("common.noResultsFor")} &ldquo;{query}&rdquo;</p>
          )}
          {!loading &&
            visibleResults.map((r) => {
              const Icon = ICON[r.type];
              return (
                <button
                  key={r.id}
                  disabled={r.locked}
                  onClick={() => {
                    if (!r.locked) {
                      router.push(r.href);
                      setOpen(false);
                      setQuery("");
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    r.locked ? "cursor-not-allowed opacity-60" : "hover:bg-surface-sunken"
                  )}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-sunken shrink-0">
                    {r.locked ? <Lock size={13} className="text-ink-faint" /> : <Icon size={13} className="text-ink-muted" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-ink font-medium">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-ink-muted">{r.subtitle}</span>}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
