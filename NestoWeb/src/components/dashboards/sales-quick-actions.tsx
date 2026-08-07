"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, Handshake, Building2, Contact, UserPlus, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Sales_Dashboard §18 — the Sales Dashboard's own Quick Action control,
// distinct from the global platform Quick Create (src/components/workspace/
// quick-create.tsx). Locked to exactly these five CRM creation actions; no
// Reserve Unit/Create Contract/Record Payment/Create Task/Schedule Meeting
// here per §18's "Quick Action lock."
const ENTRIES = [
  { labelKey: "dashboards.sales.addClient", href: "/clients?open=create", icon: Handshake },
  { labelKey: "dashboards.sales.addClientCompany", href: "/clients?open=create&clientType=Company", icon: Building2 },
  { labelKey: "dashboards.sales.addContact", href: "/clients/contacts?open=create", icon: Contact },
  { labelKey: "dashboards.sales.addLead", href: "/clients/leads?open=create", icon: UserPlus },
  { labelKey: "dashboards.sales.addOpportunity", href: "/clients/opportunities?open=create", icon: TrendingUp },
];

export function SalesQuickActions() {
  const { t } = useI18n();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
          aria-label={t("dashboards.sales.quickActions")}
        >
          <Plus size={15} /> <span className="hidden sm:inline">{t("dashboards.sales.quickActions")}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="min-w-[220px] rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50">
          {ENTRIES.map((e) => (
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
