/**
 * Architecture tests — PRD §5.4, ADR-0005, ADR-0014.
 *
 * These enforce the rules that make the modular monolith a monolith with seams
 * rather than a large ball of mud with a directory structure. Every one of them
 * corresponds to a sentence in the PRD that is otherwise only a promise.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { walkSources, importsOf, REPO_ROOT, workspaceDirs } from "./source-scan";

describe("§5.4 — the Prisma client does not leave @nesto/database", () => {
  it("is imported nowhere else", () => {
    // The rule that makes "every query is scoped" enforceable rather than
    // aspirational: if a domain could construct its own client, the scoping
    // extension would be optional.
    const offenders: string[] = [];
    for (const kind of ["packages", "domains", "apps"] as const) {
      for (const dir of workspaceDirs(kind)) {
        if (kind === "packages" && dir === "database") continue;
        for (const file of walkSources(join(REPO_ROOT, kind, dir), { includeTests: true })) {
          for (const spec of importsOf(file)) {
            if (spec === "@prisma/client" || spec.includes("generated/prisma")) {
              offenders.push(`${kind}/${dir}/${file.relativePath} imports ${spec}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not export the raw client from its own index", () => {
    const index = readFileSync(join(REPO_ROOT, "packages/database/src/index.ts"), "utf8");
    expect(index).not.toMatch(/export\s+.*\brawClient\b/);
    expect(index).not.toMatch(/export\s+.*\bPrismaClient\b/);
  });
});

describe("§5.4 — domains do not reach into each other", () => {
  it("imports only a peer's published contract, never its internals", () => {
    const offenders: string[] = [];
    for (const domain of workspaceDirs("domains")) {
      for (const file of walkSources(join(REPO_ROOT, "domains", domain), { includeTests: true })) {
        for (const spec of importsOf(file)) {
          const match = /^@nesto\/domain-([a-z-]+)(\/.*)?$/.exec(spec);
          if (!match) continue;
          const target = match[1] as string;
          const subpath = match[2] ?? "";
          if (target === domain) continue;
          // A peer may be imported only at its root or under /contracts, which
          // is where published query contracts and events live.
          if (subpath !== "" && !subpath.startsWith("/contracts")) {
            offenders.push(`domains/${domain}/${file.relativePath} imports ${spec}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no circular imports between domains", () => {
    const graph = new Map<string, Set<string>>();
    for (const domain of workspaceDirs("domains")) {
      const edges = new Set<string>();
      for (const file of walkSources(join(REPO_ROOT, "domains", domain))) {
        for (const spec of importsOf(file)) {
          const match = /^@nesto\/domain-([a-z-]+)/.exec(spec);
          if (match && match[1] !== domain) edges.add(match[1] as string);
        }
      }
      graph.set(domain, edges);
    }

    const cycles: string[] = [];
    const seen = new Set<string>();
    const stack: string[] = [];
    const visit = (node: string): void => {
      if (stack.includes(node)) {
        cycles.push([...stack.slice(stack.indexOf(node)), node].join(" -> "));
        return;
      }
      if (seen.has(node)) return;
      seen.add(node);
      stack.push(node);
      for (const next of graph.get(node) ?? []) visit(next);
      stack.pop();
    };
    for (const domain of graph.keys()) visit(domain);
    expect(cycles).toEqual([]);
  });
});

describe("§6.3 — cross-tenant escape hatches stay out of request paths", () => {
  it("keeps unscopedScope out of the API", () => {
    // It exists for the seed, the outbox relay and maintenance jobs. Reaching
    // it from a request would defeat the entire scoping design.
    const offenders: string[] = [];
    const apiDir = join(REPO_ROOT, "apps/api");
    for (const file of walkSources(apiDir, { includeTests: false })) {
      if (/\bunscopedScope\b/.test(file.content)) offenders.push(`apps/api/${file.relativePath}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("§11.1 / §11.2 — the physical schema keeps its own rules", () => {
  const schemaDir = join(REPO_ROOT, "packages/database/prisma/schema");
  const modelBlocks = (): { name: string; body: string; file: string }[] => {
    const out: { name: string; body: string; file: string }[] = [];
    for (const entry of readdirSync(schemaDir).filter((f) => f.endsWith(".prisma"))) {
      const text = readFileSync(join(schemaDir, entry), "utf8");
      for (const match of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
        out.push({ name: match[1] as string, body: match[2] as string, file: entry });
      }
    }
    return out;
  };

  it("gives every model an explicit schema", () => {
    // Physical ownership is not optional: it is what makes the grant matrix and
    // the "no cross-schema write" rule enforceable.
    const missing = modelBlocks().filter((m) => !/@@schema\("/.test(m.body)).map((m) => `${m.file}:${m.name}`);
    expect(missing).toEqual([]);
  });

  it("uses uuid columns for identifiers, never Prisma-generated defaults", () => {
    // ADR-0001: ids are minted in the application so a command can build a whole
    // aggregate before it opens a transaction, and a retry can reuse them.
    const offenders = modelBlocks()
      .filter((m) => /id\s+String\s+@id[^\n]*@default\((uuid|cuid|autoincrement)/.test(m.body))
      .map((m) => `${m.file}:${m.name}`);
    expect(offenders).toEqual([]);

    const notUuid = modelBlocks()
      .filter((m) => /^\s*id\s+String\s+@id/m.test(m.body) && !/^\s*id\s+String\s+@id\s+@db\.Uuid/m.test(m.body))
      .map((m) => `${m.file}:${m.name}`);
    expect(notUuid).toEqual([]);
  });

  it("stores money as Decimal and never as Float", () => {
    // §11.5 forbids Float outright. A Float column is a rounding bug that will
    // not surface until it is a dispute with a real person.
    const offenders = modelBlocks()
      .filter((m) => /\bFloat\b/.test(m.body))
      .map((m) => `${m.file}:${m.name}`);
    expect(offenders).toEqual([]);
  });

  it("stores instants as timestamptz, so a deployment's timezone cannot change history", () => {
    const offenders: string[] = [];
    for (const m of modelBlocks()) {
      for (const line of m.body.split("\n")) {
        if (/\bDateTime\b/.test(line) && !/@db\.(Timestamptz|Date)/.test(line) && !/@updatedAt/.test(line)) {
          offenders.push(`${m.file}:${m.name}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§26.5 — the workspace stays coherent", () => {
  it("declares every workspace dependency it imports", () => {
    const offenders: string[] = [];
    for (const kind of ["packages", "domains", "apps"] as const) {
      for (const dir of workspaceDirs(kind)) {
        const pkgPath = join(REPO_ROOT, kind, dir, "package.json");
        if (!existsSync(pkgPath)) continue;
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          name: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const declared = new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ]);
        for (const file of walkSources(join(REPO_ROOT, kind, dir), { includeTests: true })) {
          for (const spec of importsOf(file)) {
            if (!spec.startsWith("@nesto/")) continue;
            const name = spec.split("/").slice(0, 2).join("/");
            if (name !== pkg.name && !declared.has(name)) {
              offenders.push(`${pkg.name} imports ${name} in ${file.relativePath} without declaring it`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
