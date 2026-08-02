"use client";

import { useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Languages, Check } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/locale-provider";

export function LanguageSwitcher() {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label="Change language"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50"
        >
          <Languages size={16} />
          <span>{LOCALE_LABELS[locale]}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
