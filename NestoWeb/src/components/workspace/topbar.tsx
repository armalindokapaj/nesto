"use client";

import { useTransition } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu, ChevronDown, LogOut, Settings, HelpCircle, PanelLeftClose, PanelLeftOpen, ClipboardCheck, ShieldCheck, CalendarDays, UploadCloud } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { logout } from "@/app/actions/auth";
import { GlobalSearch } from "@/components/workspace/global-search";
import { NotificationBell } from "@/components/workspace/notification-bell";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { QuickCreate } from "@/components/workspace/quick-create";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function Topbar({
  onToggleMobile,
  onToggleCollapse,
  collapsed,
  userName,
  role,
  avatarColor,
  notificationCount,
  inboxCount,
  isPlatformAdmin,
  canUpload,
  uploadProjects,
}: {
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  userName: string;
  role: Role;
  avatarColor: string;
  notificationCount: number;
  inboxCount: number;
  isPlatformAdmin?: boolean;
  canUpload?: boolean;
  uploadProjects?: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/95 backdrop-blur px-4 md:px-6 shrink-0">
      <button onClick={onToggleMobile} className="md:hidden text-ink-muted" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <button
        onClick={onToggleCollapse}
        className="hidden md:flex text-ink-muted hover:text-ink transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <QuickCreate role={role} />
        {canUpload && (
          <CreateDocumentDialog
            projects={uploadProjects}
            triggerLabel={t("documents.universalUpload")}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-lg"
                aria-label={t("documents.universalUpload")}
                title={t("documents.universalUpload")}
              >
                <UploadCloud size={18} />
              </Button>
            }
          />
        )}
        <Link
          href="/calendar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          aria-label={t("calendar.title")}
          title={t("calendar.title")}
        >
          <CalendarDays size={18} />
        </Link>
        <Link
          href="/inbox"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          aria-label={t("inbox.title")}
          title={t("inbox.title")}
        >
          <ClipboardCheck size={18} />
          {inboxCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold text-white">
              {inboxCount > 9 ? "9+" : inboxCount}
            </span>
          )}
        </Link>
        <NotificationBell initialCount={notificationCount} />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-sunken transition-colors">
              <Avatar name={userName} color={avatarColor} size={30} />
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-medium text-ink">{userName}</span>
                <span className="text-[0.65rem] text-ink-muted">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronDown size={14} className="text-ink-faint hidden sm:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="min-w-[200px] rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50"
            >
              <DropdownMenu.Item asChild>
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none"
                >
                  <Settings size={15} className="text-ink-muted" /> {t("common.accountSettings")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/help"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none"
                >
                  <HelpCircle size={15} className="text-ink-muted" /> {t("common.helpSupport")}
                </Link>
              </DropdownMenu.Item>
              {isPlatformAdmin && (
                <DropdownMenu.Item asChild>
                  <Link
                    href="/platform/applications"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none"
                  >
                    <ShieldCheck size={15} className="text-gold" /> {t("platform.applicationsTitle")}
                  </Link>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => startTransition(() => logout())}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger hover:bg-danger-soft cursor-pointer outline-none"
              >
                <LogOut size={15} /> {t("common.signOut")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
