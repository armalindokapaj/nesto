import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// A Prisma config file switches off Prisma's own dotenv loading, so the
// monorepo's single .env is loaded explicitly. One .env at the root, not one
// per package: the database URL is a property of the machine, not of a package.
loadEnv({ path: "../../.env", quiet: true });

/**
 * Prisma configuration. `package.json#prisma` is deprecated as of 6.19 and
 * removed in 7, so the schema location lives here.
 *
 * `schema` points at a *folder*: one .prisma file per bounded context, each
 * declaring its own `@@schema` (ADR-0002). One generated client, many database
 * schemas — which is exactly what a modular monolith needs: separate ownership,
 * one connection pool.
 */
export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed/index.ts",
  },
});
