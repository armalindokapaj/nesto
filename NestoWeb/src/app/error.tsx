"use client";

import { useEffect } from "react";

// Phase 5 Track B — the App Router had no error.tsx anywhere, so any unhandled
// exception during a render showed Next's unbranded crash screen with no way
// back except reloading and hoping.
//
// This is the outer boundary; almost everything real is caught by the
// (workspace) one, which keeps the shell intact.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is the only handle correlating what the user saw with the
    // server-side log line, since Next deliberately withholds the message on
    // the client in production.
    console.error(JSON.stringify({ level: "error", kind: "RootBoundary", digest: error.digest }));
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This has been logged. Try again, or reload the page.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>}
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
