import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    // A domain whose only unit-testable surface is its permission manifest has
    // no local tests, and that is correct: manifests are validated centrally in
    // packages/testing, where cross-domain invariants — one owner per key, no
    // platform.* in any base role, no orphaned permission — can actually be
    // checked. A per-domain copy could only re-assert what one manifest says
    // about itself.
    passWithNoTests: true,
  },
});
