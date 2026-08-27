import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // One retry in CI only: a suite that goes red on infrastructure flake
  // stops being read, which defeats the point of gating merges on it.
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
  },
  webServer: {
    // A production build, not `next dev`. Dev-mode compilation of this app
    // under parallel workers exhausts memory and the server gets OOM-killed
    // partway through the run; that surfaces as dozens of
    // ERR_CONNECTION_REFUSED failures which read as application bugs but are
    // not. `next build` takes ~20s here and `next start` is stable under load
    // — and it exercises what actually ships.
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
