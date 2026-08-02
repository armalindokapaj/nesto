import en from "./messages/en.json";
import sq from "./messages/sq.json";
import type { Locale } from "./config";

export const dictionaries = { en, sq } satisfies Record<Locale, unknown>;

export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}

/** Dot-path lookup, e.g. t(dict, "nav.dashboard"). Falls back to the key itself if missing. */
export function translate(dict: Dictionary, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : key;
}
