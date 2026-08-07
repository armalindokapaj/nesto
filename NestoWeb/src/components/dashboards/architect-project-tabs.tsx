import Link from "next/link";
import { getT } from "@/lib/i18n/server";

// PRD_Architect_Dashboard §14 — exact tab set. Tasks/Documents/BIM link to
// the existing shared pages filtered by project instead of duplicating them
// as nested routes (§14 "must not create duplicate ... task ... document ...
// BIM records").
export async function ArchitectProjectTabs({ projectId, active }: { projectId: string; active: string }) {
  const { t } = await getT();
  const base = `/dashboard/architect/projects/${projectId}`;
  const tabs = [
    { slug: "", label: t("dashboards.finance.tabOverview") },
    { slug: "drawings", label: t("nav.drawings"), href: `${base}/drawings` },
    { slug: "rfis", label: t("nav.rfis"), href: `${base}/rfis` },
    { slug: "revisions", label: t("nav.revisions"), href: `${base}/revisions` },
    { slug: "submittals", label: t("nav.submittals"), href: `${base}/submittals` },
    { slug: "approvals", label: t("nav.approvals"), href: `${base}/approvals` },
    { slug: "client-requests", label: t("nav.clientRequests"), href: `${base}/client-requests` },
    { slug: "tasks", label: t("nav.tasks"), href: `/tasks?projectId=${projectId}` },
    { slug: "documents", label: t("nav.documents"), href: `/documents?projectId=${projectId}` },
    { slug: "bim", label: t("nav.bim"), href: `/dashboard/bim?projectId=${projectId}` },
  ];
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Project Architecture tabs">
      {tabs.map((tab) => {
        const isActive = tab.slug === active;
        return (
          <Link
            key={tab.slug || "overview"}
            href={tab.href ?? base}
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
