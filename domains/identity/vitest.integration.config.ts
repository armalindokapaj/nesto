import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    setupFiles: ["../../packages/testing/src/env-setup.ts"],
  },
});
