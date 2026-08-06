"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Plus,
  CheckSquare,
  FileText,
  Handshake,
  ScrollText,
  Briefcase,
  Scale,
  Lock,
  Ticket,
  Megaphone,
  CalendarDays,
  Truck,
  Box,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Platform_UI_UX_Architecture §13 Quick Create — "The global Create
// action exposes only authorized, relevant record types." Scoped here to a
// launcher: each entry routes to the record type's own existing create
// entry point (dialog/page) rather than reimplementing every module's
// creation form a second time in a floating drawer — zero risk of the
// launcher and the module page's own logic drifting apart.
const ENTRIES: { labelKey: string; href: string; icon: typeof Plus; resource?: Parameters<typeof can>[1]; level?: Parameters<typeof can>[2] }[] = [
  { labelKey: "quickCreate.task", href: "/tasks", icon: CheckSquare, resource: "TASKS", level: "WRITE" },
  { labelKey: "quickCreate.document", href: "/documents", icon: FileText, resource: "DOCUMENTS", level: "WRITE" },
  { labelKey: "quickCreate.client", href: "/clients", icon: Handshake, resource: "CLIENTS", level: "WRITE" },
  { labelKey: "quickCreate.contract", href: "/contracts", icon: ScrollText, resource: "CONTRACTS", level: "WRITE" },
  { labelKey: "quickCreate.vacancy", href: "/dashboard/hr/recruitment", icon: Briefcase, resource: "HR", level: "WRITE" },
  { labelKey: "quickCreate.legalCase", href: "/dashboard/legal/cases", icon: Scale, resource: "LEGAL", level: "WRITE" },
  { labelKey: "quickCreate.legalHold", href: "/dashboard/legal/holds", icon: Lock, resource: "LEGAL", level: "FULL" },
  { labelKey: "quickCreate.itTicket", href: "/dashboard/admin/it/tickets", icon: Ticket }, // anyone may raise a ticket
  { labelKey: "quickCreate.announcement", href: "/announcements", icon: Megaphone, resource: "USER_MANAGEMENT", level: "FULL" },
  { labelKey: "quickCreate.meeting", href: "/meetings", icon: CalendarDays },
  { labelKey: "quickCreate.supplier", href: "/dashboard/procurement/suppliers", icon: Truck, resource: "PROCUREMENT", level: "WRITE" },
  { labelKey: "quickCreate.bimModel", href: "/dashboard/bim", icon: Box, resource: "PROJECTS", level: "WRITE" },
];

export function QuickCreate({ role }: { role: Role }) {
  const { t } = useI18n();
  const available = ENTRIES.filter((e) => !e.resource || can(role, e.resource, e.level ?? "READ"));
  if (available.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
          aria-label={t("quickCreate.title")}
        >
          <Plus size={15} /> <span className="hidden sm:inline">{t("quickCreate.title")}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="min-w-[220px] rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50">
          {available.map((e) => (
            <DropdownMenu.Item key={e.labelKey} asChild>
              <Link href={e.href} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none">
                <e.icon size={15} className="text-ink-muted" /> {t(e.labelKey)}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
