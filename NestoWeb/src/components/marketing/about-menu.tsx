"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, PlayCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export function AboutMenu() {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1">
      <LanguageSwitcher />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-1.5 text-sm font-medium text-ink hover:text-gold transition-colors focus-visible:outline-none px-2.5 py-1.5">
            {t("landing.about")} <ChevronDown size={14} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={12}
            className="min-w-[220px] rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50"
          >
            <DropdownMenu.Item className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none">
              <ShieldCheck size={16} className="text-gold" /> {t("landing.requestDemo")}
            </DropdownMenu.Item>
            <DropdownMenu.Item className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none">
              <PlayCircle size={16} className="text-gold" /> {t("landing.security")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
