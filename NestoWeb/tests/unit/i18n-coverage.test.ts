import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A missing translation key is not an exception — `t()` falls back to printing
 * the key itself, so the app renders a literal "nav.rfqs" in the sidebar and
 * everything else keeps working. Nothing fails, nothing logs, and it survives
 * typecheck, lint, unit tests and the build.
 *
 * That is exactly how 92 keys accumulated across the Procurement, QA/QC,
 * Inventory and Handover navigations before anyone noticed. This test is the
 * thing that would have noticed.
 */

const LOCALES = ["en", "sq"] as const;

function loadDictionary(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`, "utf8"));
}

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}) {
  if (typeof value === "string") {
    out[prefix.replace(/\.$/, "")] = value;
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "generated") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * Static keys only. A computed key — `t(\`hse.severity_${row.severity}\`)` —
 * cannot be resolved without running the app, so it is out of scope here
 * rather than guessed at.
 */
function usedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  const patterns = [
    /\bt\(\s*"([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)"/g,
    /labelKey: "([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)"/g,
  ];
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        if (!used.has(match[1])) used.set(match[1], file);
      }
    }
  }
  return used;
}

describe("i18n coverage", () => {
  const dictionaries = Object.fromEntries(LOCALES.map((l) => [l, flatten(loadDictionary(l))]));

  it.each(LOCALES)("%s defines every statically-referenced key", (locale) => {
    const dictionary = dictionaries[locale];
    const missing = [...usedKeys()]
      .filter(([key]) => typeof dictionary[key] !== "string")
      .map(([key, file]) => `${key}  (used in ${file})`);
    expect(missing.join("\n")).toBe("");
  });

  // Divergence is the other half: a key present in one locale and absent from
  // the other renders fine for whoever wrote it and shows a raw key to
  // everyone else, which is harder to spot than a key missing from both.
  it("keeps the locales in sync with each other", () => {
    const [en, sq] = LOCALES.map((l) => new Set(Object.keys(dictionaries[l])));
    const onlyEn = [...en].filter((k) => !sq.has(k));
    const onlySq = [...sq].filter((k) => !en.has(k));
    expect({ onlyEn, onlySq }).toEqual({ onlyEn: [], onlySq: [] });
  });

  it("has no key whose translation is still the key itself", () => {
    // A stub like "nav.rfqs": "nav.rfqs" would satisfy every check above while
    // rendering exactly the same raw text to the user.
    for (const locale of LOCALES) {
      const echoed = Object.entries(dictionaries[locale]).filter(([k, v]) => v === k);
      expect(echoed, locale).toEqual([]);
    }
  });
});
