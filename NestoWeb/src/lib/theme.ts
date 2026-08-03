import type { Theme } from "@/lib/constants";

// Resolves the `data-theme` attribute value to stamp on <html>. `undefined`
// means "no override", i.e. Platform Default.
export function resolveDataTheme(theme: Theme): string | undefined {
  if (theme === "NIGHT") return "dark";
  return undefined;
}
