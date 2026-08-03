"use client";

import { useTransition } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Languages, Mail, PlayCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale-provider";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";

export function AboutMenu() {
  const { t, locale } = useI18n();
  const [pending, startTransition] = useTransition();
  // Only two locales exist — show a single item for the OTHER one rather
  // than a submenu with a checkmark against the current one; clicking it
  // is the entire interaction (English shown -> click to switch to Shqip,
  // and vice versa).
  const otherLocale = LOCALES.find((l) => l !== locale) ?? locale;

  return (
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
          <DropdownMenu.Item asChild className="rounded-lg outline-none cursor-pointer">
            <Link href="/request-demo" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken">
              <PlayCircle size={16} className="text-gold" /> {t("landing.requestDemo")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="rounded-lg outline-none cursor-pointer">
            <Link href="/security" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken">
              <ShieldCheck size={16} className="text-gold" /> {t("landing.security")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="rounded-lg outline-none cursor-pointer">
            <Link href="/contact" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken">
              <Mail size={16} className="text-gold" /> {t("landing.contactUs")}
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

          <DropdownMenu.Item
            disabled={pending}
            onSelect={() => startTransition(() => setLocale(otherLocale))}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink outline-none cursor-pointer hover:bg-surface-sunken disabled:opacity-50"
          >
            <Languages size={16} className="text-gold" />
            {LOCALE_LABELS[otherLocale]}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
