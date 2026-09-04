import { defineConfig } from "vitest/config";

// Integration tests run against the real Postgres from docker compose, with RLS
// on and connecting as nesto_app. A mock would prove nothing here: the whole
// point is that the database enforces what the application claims.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // These share one database, so they must not race each other.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
