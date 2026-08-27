"use client";

import { useEffect } from "react";
import Link from "next/link";

// Phase 5 Track B — the boundary that catches almost everything, since every
// real page lives under this route group. Renders inside the workspace shell so
// the nav and sidebar stay usable: a failed page should not strand someone with
// no way to navigate anywhere else.
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", kind: "WorkspaceBoundary", digest: error.digest }));
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center">
      <div className="max-w-sm">
        <h2 className="text-base font-semibold text-ink">This page couldn&apos;t load</h2>
        <p className="mt-2 text-sm text-ink-muted">
          This has been logged. Try again, or head back to your dashboard.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={reset} className="rounded-lg bg-ink px-4 py-2 text-sm text-white hover:opacity-90">
            Try again
          </button>
          <Link href="/dashboard/executive" className="rounded-lg border border-border px-4 py-2 text-sm text-ink hover:bg-surface-sunken">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
