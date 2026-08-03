"use client";

import { useTransition } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, ChevronRight, Check, Languages, Mail, PlayCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale-provider";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";

export function AboutMenu() {
  const { t, locale } = useI18n();
  const [pending, startTransition] = useTransition();

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

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              disabled={pending}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink outline-none cursor-pointer data-[state=open]:bg-surface-sunken hover:bg-surface-sunken disabled:opacity-50"
            >
              <Languages size={16} className="text-gold" />
              <span className="flex-1 text-left">{LOCALE_LABELS[locale]}</span>
              <ChevronRight size={14} className="text-ink-faint" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={8}
                className="min-w-[160px] rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50"
              >
                {LOCALES.map((l) => (
                  <DropdownMenu.Item
                    key={l}
                    onSelect={() => startTransition(() => setLocale(l))}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunken cursor-pointer outline-none"
                  >
                    {LOCALE_LABELS[l]}
                    {l === locale && <Check size={14} className="text-gold" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
