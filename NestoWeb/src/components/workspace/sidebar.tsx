"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/workspace/nav-link";
import { NestoLogo, NestoMark } from "@/components/branding/NestoLogo";
import { NAV_SECTIONS, workspaceKeyFromPath, visibleNavSections } from "@/lib/nav-config";
import { DASHBOARD_BY_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import { X } from "lucide-react";
import type { Role } from "@/lib/constants";
import type { ModuleKey } from "@/lib/modules";

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  companyName,
  workspaceLabel,
  role,
  disabledModules,
  disabledRoutes,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  companyName: string;
  workspaceLabel: string;
  role: Role;
  disabledModules?: ModuleKey[];
  // Platform Configuration — routes whose page node resolved to disabled.
  disabledRoutes?: string[];
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const disabledSet = new Set(disabledModules ?? []);
  const disabledRouteSet = new Set(disabledRoutes ?? []);
  const sections = visibleNavSections(
    NAV_SECTIONS[workspaceKeyFromPath(pathname, role)],
    role,
    disabledSet,
    disabledRouteSet
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-transform duration-[var(--motion-slow)] ease-[var(--motion-ease)] md:sticky md:top-0 md:h-screen md:translate-x-0 md:shrink-0",
          collapsed ? "md:w-[76px]" : "md:w-[248px]",
          "w-[248px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
          {collapsed ? (
            <Link href={DASHBOARD_BY_ROLE[role]} className="mx-auto" aria-label="Go to dashboard">
              <NestoMark size={26} className="text-gold" />
            </Link>
          ) : (
            <Link href={DASHBOARD_BY_ROLE[role]} aria-label="Go to dashboard">
              <NestoLogo size={22} />
              <p className="text-[0.65rem] text-ink-muted mt-0.5 truncate max-w-[180px]">{workspaceLabel}</p>
            </Link>
          )}
          <button onClick={onCloseMobile} className="md:hidden text-ink-muted" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Named so it is distinguishable from the per-page section navs,
            which all carry their own aria-label. Without it a screen reader
            announces two unlabelled "navigation" landmarks on every page. */}
        <nav aria-label="Workspace" className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {sections.map((section, si) => (
            <div key={si}>
              {section.titleKey && !collapsed && (
                <p className="px-2.5 mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                  {t(section.titleKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        onClick={onCloseMobile}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-[var(--motion-fast)]",
                          active
                            ? "bg-gold-soft text-gold-strong"
                            : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                          collapsed && "justify-center"
                        )}
                        title={collapsed ? t(item.labelKey) : undefined}
                      >
                        <item.icon size={17} className="shrink-0" />
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="p-3 border-t border-border shrink-0">
            <p className="text-[0.65rem] text-ink-faint px-1.5">{companyName}</p>
          </div>
        )}
      </aside>
    </>
  );
}
