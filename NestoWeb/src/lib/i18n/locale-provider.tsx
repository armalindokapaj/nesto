"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";
import { translate } from "./dictionaries";

type I18nContextValue = { locale: Locale; t: (key: string) => string };
const I18nContext = createContext<I18nContextValue | null>(null);

// Seeded from a Server Component (RootLayout) that already resolved the
// locale + dictionary from the cookie — Client Components never re-resolve
// the locale themselves, they just consume what the server decided.
export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key: string) => translate(dictionary, key) }),
    [locale, dictionary]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LocaleProvider");
  }
  return ctx;
}
