import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, LOCALES, type Locale } from "./config";
import { getDictionary, translate } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

/** Server Component helper: `const t = await getT();` then `t("nav.dashboard")`. */
export async function getT() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return { t: (key: string) => translate(dict, key), locale, dict };
}
