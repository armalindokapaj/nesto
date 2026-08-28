import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Phase 4 — one pager for every paginated list, driven by the same `page`
// search param the server reads, so it works without client JavaScript and
// keeps whatever other filters the page already has in the URL.
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  pageKey = "page",
  searchParams = {},
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Which search param drives this pager. Only differs from "page" when one route shows two lists. */
  pageKey?: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && k !== pageKey) params.set(k, v);
    }
    params.set(pageKey, String(target));
    return `?${params.toString()}`;
  };

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-ink-muted">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-ink hover:bg-surface-sunken">
            <ChevronLeft size={14} /> Previous
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-ink-faint">
            <ChevronLeft size={14} /> Previous
          </span>
        )}
        <span className="px-2 text-xs text-ink-muted">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={href(page + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-ink hover:bg-surface-sunken">
            Next <ChevronRight size={14} />
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-ink-faint">
            Next <ChevronRight size={14} />
          </span>
        )}
      </div>
    </div>
  );
}
