export const LOCALES = ["sq", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// Albanian is the product default per the PRD's primary market; English is
// the secondary/fallback language. Both are first-class — nothing here
// treats English as canonical.
export const DEFAULT_LOCALE: Locale = "sq";
export const LOCALE_COOKIE = "nesto_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  sq: "Shqip",
  en: "English",
};
