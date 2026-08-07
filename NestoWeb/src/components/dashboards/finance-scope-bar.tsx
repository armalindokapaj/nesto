import Link from "next/link";
import { getT } from "@/lib/i18n/server";

// PRD_Finance_Dashboard §5.1 — Company Overview / All Projects / Select
// Project scope switcher. Each mode is its own route (not client tab state)
// so a deep link resolves directly into that scope while staying inside the
// Finance shell (§16 "deep link never expands permission" and preserves
// shell/scope on navigation).
export async function FinanceScopeBar({ mode, projectName }: { mode: "company" | "all-projects" | "project"; projectName?: string }) {
  const { t } = await getT();
  return (
    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Finance scope">
      <ScopeLink href="/dashboard/finance" active={mode === "company"} label={t("dashboards.finance.scopeCompany")} />
      <ScopeLink href="/dashboard/finance/projects" active={mode === "all-projects"} label={t("dashboards.finance.scopeAllProjects")} />
      {mode === "project" && projectName && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-ink">{projectName}</span>
      )}
    </nav>
  );
}

function ScopeLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-medium text-canvas"
          : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
