import { PrefetchLink } from "@/components/ui/prefetch-link";
import { getT } from "@/lib/i18n/server";

// PRD_Finance_Dashboard §10 — exact, locked Project Finance tab set.
const TABS = [
  { slug: "", labelKey: "dashboards.finance.tabOverview" },
  { slug: "spendings", labelKey: "dashboards.finance.tabSpendings" },
  { slug: "budget", labelKey: "dashboards.finance.tabBudget" },
  { slug: "revenue", labelKey: "dashboards.finance.tabRevenue" },
  { slug: "expenses", labelKey: "dashboards.finance.tabExpenses" },
  { slug: "contracts", labelKey: "dashboards.finance.tabContracts" },
  { slug: "procurement", labelKey: "dashboards.finance.tabProcurement" },
  { slug: "invoices", labelKey: "dashboards.finance.tabInvoices" },
  { slug: "payments", labelKey: "dashboards.finance.tabPayments" },
  { slug: "units", labelKey: "dashboards.finance.tabUnits" },
  { slug: "forecast", labelKey: "dashboards.finance.tabForecast" },
  { slug: "reports", labelKey: "dashboards.finance.tabReports" },
] as const;

export async function ProjectFinanceTabs({ projectId, active }: { projectId: string; active: string }) {
  const { t } = await getT();
  const base = `/dashboard/finance/projects/${projectId}`;
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Project Finance tabs">
      {TABS.map((tab) => {
        const isActive = tab.slug === active;
        return (
          <PrefetchLink
            key={tab.slug}
            href={tab.slug ? `${base}/${tab.slug}` : base}
            className={
              isActive
                ? "px-3 py-2 text-sm font-medium text-ink border-b-2 border-gold -mb-px"
                : "px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            }
          >
            {t(tab.labelKey)}
          </PrefetchLink>
        );
      })}
    </nav>
  );
}
