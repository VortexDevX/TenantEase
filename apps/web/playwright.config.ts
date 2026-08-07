import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "corepack pnpm --dir ../api dev",
          url: "http://localhost:4000/health",
          reuseExistingServer: true,
          timeout: 120_000
        },
        {
          command: "corepack pnpm dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000
        }
      ]
});
