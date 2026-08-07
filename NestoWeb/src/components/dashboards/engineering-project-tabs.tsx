import Link from "next/link";
import { getT } from "@/lib/i18n/server";

// PRD_Engineer_Dashboard §14/§5.1 — exact tab set. Tasks/Documents/BIM link
// to the existing shared pages filtered by project instead of duplicating
// them as nested routes (same rule as Architecture's tabs).
export async function EngineeringProjectTabs({ projectId, active }: { projectId: string; active: string }) {
  const { t } = await getT();
  const base = `/dashboard/engineering/projects/${projectId}`;
  const tabs = [
    { slug: "", label: t("dashboards.finance.tabOverview"), href: base },
    { slug: "packages", label: t("nav.engineeringPackages"), href: `${base}/packages` },
    { slug: "specifications", label: t("nav.specifications"), href: `${base}/specifications` },
    { slug: "calculations", label: t("nav.calculations"), href: `${base}/calculations` },
    { slug: "rfis", label: t("nav.rfis"), href: `/dashboard/engineering/rfis?projectId=${projectId}` },
    { slug: "submittals", label: t("nav.submittals"), href: `/dashboard/engineering/submittals?projectId=${projectId}` },
    { slug: "inspections", label: t("nav.inspections"), href: `/dashboard/engineering/inspections?projectId=${projectId}` },
    { slug: "coordination", label: t("nav.coordination"), href: `/dashboard/engineering/coordination?projectId=${projectId}` },
    { slug: "tasks", label: t("nav.tasks"), href: `/tasks?projectId=${projectId}` },
    { slug: "documents", label: t("nav.documents"), href: `/documents?projectId=${projectId}` },
    { slug: "bim", label: t("nav.bim"), href: `/dashboard/bim?projectId=${projectId}` },
  ];
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Project Engineering tabs">
      {tabs.map((tab) => {
        const isActive = tab.slug === active;
        return (
          <Link
            key={tab.slug || "overview"}
            href={tab.href}
            className={
              isActive
                ? "px-3 py-2 text-sm font-medium text-ink border-b-2 border-gold -mb-px"
                : "px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
