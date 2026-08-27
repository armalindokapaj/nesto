"use client";

// Phase 5 Track B — the last resort: this catches a failure in the root layout
// itself, which error.tsx cannot, and so must render its own <html>/<body>.
// It deliberately uses inline styles: if the root layout failed, the stylesheet
// it links may never have loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#1A1D23" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: "#5A616E" }}>This has been logged. Reload the page to continue.</p>
            {error.digest && <p style={{ marginTop: 12, fontSize: 12, fontFamily: "monospace", color: "#8A909B" }}>Reference: {error.digest}</p>}
            <button onClick={reset} style={{ marginTop: 16, borderRadius: 8, border: 0, background: "#1A1D23", color: "#fff", padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
