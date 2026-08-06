"use client";

import { useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { Role } from "@/lib/constants";
import type { ModuleKey } from "@/lib/modules";

export function WorkspaceShell({
  companyName,
  workspaceLabel,
  userName,
  role,
  avatarColor,
  notificationCount,
  inboxCount,
  isPlatformAdmin,
  disabledModules,
  disabledRoutes,
  canUpload,
  uploadProjects,
  children,
}: {
  companyName: string;
  workspaceLabel: string;
  userName: string;
  role: Role;
  avatarColor: string;
  notificationCount: number;
  inboxCount: number;
  isPlatformAdmin?: boolean;
  disabledModules?: ModuleKey[];
  disabledRoutes?: string[];
  canUpload?: boolean;
  uploadProjects?: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        companyName={companyName}
        workspaceLabel={workspaceLabel}
        role={role}
        disabledModules={disabledModules}
        disabledRoutes={disabledRoutes}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onToggleMobile={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
          userName={userName}
          role={role}
          avatarColor={avatarColor}
          notificationCount={notificationCount}
          inboxCount={inboxCount}
          isPlatformAdmin={isPlatformAdmin}
          canUpload={canUpload}
          uploadProjects={uploadProjects}
        />
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
        <footer className="px-4 md:px-6 py-4 text-center text-xs text-ink-faint border-t border-border">
          © {new Date().getFullYear()} Nesto. {t("footer.rights")} ·{" "}
          <a href="#" className="hover:text-ink-muted">{t("footer.privacy")}</a> ·{" "}
          <a href="#" className="hover:text-ink-muted">{t("footer.terms")}</a>
        </footer>
      </div>
    </div>
  );
}
