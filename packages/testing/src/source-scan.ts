/**
 * A small source scanner for the architecture tests.
 *
 * Deliberately not a TypeScript program analysis: the rules being enforced are
 * about *imports and strings*, which regexes see perfectly well, and a
 * full-program pass over a monorepo this size on every commit would be slow
 * enough that people would start skipping it.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export type SourceFile = { path: string; relativePath: string; content: string };

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "generated", "coverage", ".git"]);

export function walkSources(root: string, options: { includeTests?: boolean } = {}): SourceFile[] {
  const out: SourceFile[] = [];
  if (!existsSync(root)) return out;

  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        visit(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        const isTest = /\.(test|spec)\.tsx?$/.test(entry) || full.includes("__tests__");
        if (isTest && !options.includeTests) continue;
        out.push({ path: full, relativePath: relative(root, full), content: readFileSync(full, "utf8") });
      }
    }
  };
  visit(root);
  return out;
}

const IMPORT_PATTERN = /(?:import|export)\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

export function importsOf(file: SourceFile): string[] {
  const found: string[] = [];
  for (const match of file.content.matchAll(IMPORT_PATTERN)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec) found.push(spec);
  }
  return found;
}

export const REPO_ROOT = (() => {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = join(dir, "..");
  }
  throw new Error("Could not locate the workspace root.");
})();

export function workspaceDirs(kind: "packages" | "domains" | "apps"): string[] {
  const base = join(REPO_ROOT, kind);
  if (!existsSync(base)) return [];
  return readdirSync(base).filter((d) => statSync(join(base, d)).isDirectory());
}
