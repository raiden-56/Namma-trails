import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real stack (Next.js + NestJS API + PostgreSQL).
 *
 * Prerequisites: `pnpm db:up`, migrations applied, reference data seeded, and
 * `pnpm --filter @kt/api build`. Servers already running on :3000/:4000 are
 * reused; otherwise Playwright starts them.
 *
 * Browser: the bundled Chromium by default. Where it can't be downloaded
 * (e.g. a corporate proxy), use an installed browser: PW_CHANNEL=msedge or PW_CHANNEL=chrome.
 */
const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests share one database and the OTP rate limits
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Video needs Playwright's ffmpeg download; opt in with PW_VIDEO=1. Traces + screenshots cover failures.
    video: process.env.PW_VIDEO ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) },
    },
  ],
  webServer: [
    {
      command: "node --env-file=.env dist/main.js",
      cwd: "../api",
      url: `${API_URL}/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm dev",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
