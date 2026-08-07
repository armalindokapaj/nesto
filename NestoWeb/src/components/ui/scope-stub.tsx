import { Info } from "lucide-react";

// Honest "not yet built" leaf — same treatment given to every other genuine
// scope gap this project has hit (HR's Expenses/Performance/Disciplinary,
// BIM's full CAD pipeline): a real page stating what's missing, never
// fabricated data standing in for a model that doesn't exist.
export function ScopeStub({ title, description, note }: { title: string; description: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <Info className="mx-auto mb-3 text-ink-faint" size={22} />
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      {note && <p className="mx-auto mt-3 max-w-md text-xs text-ink-faint">{note}</p>}
    </div>
  );
}
