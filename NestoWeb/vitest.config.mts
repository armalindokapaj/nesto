import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": new URL("./tests/unit/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Several unit tests exercise a real database. That was a local SQLite
    // file and effectively instant; against Postgres (a Neon instance over the
    // network in development, a container in CI) a 5s default times out on
    // round-trips alone, which reads as a failure but is only latency.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
