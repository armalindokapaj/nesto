import { defineConfig } from "vitest/config";

// Unit tests only. The integration suite needs a live Postgres and has its own
// config; mixing them means `pnpm test` fails on a machine with no database,
// which trains people to ignore a red suite.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
