import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const skipWebServer = Boolean(process.env.PLAYWRIGHT_SKIP_WEBSERVER);
const database = process.env.DATABASE_URL_TEST;
const webOrigin = "http://127.0.0.1:3000";
const apiOrigin = "http://127.0.0.1:4000";

if (!skipWebServer && (!database || !decodeURIComponent(new URL(database).pathname).endsWith("_test"))) {
  throw new Error("Set DATABASE_URL_TEST to a dedicated '_test' database before running browser tests.");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? webOrigin,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "corepack pnpm --dir ../api exec cross-env NODE_ENV=test tsx src/server.ts",
          url: `${apiOrigin}/health`,
          reuseExistingServer: false,
          env: {
            DATABASE_URL_TEST: database!,
            API_HOST: "127.0.0.1",
            API_PORT: "4000",
            WEB_URL: webOrigin,
            STORAGE_DIR: fileURLToPath(new URL("../../tmp/playwright-storage", import.meta.url)),
            SMS_PROVIDER: "mock",
            EMAIL_PROVIDER: "mock",
            WHATSAPP_PROVIDER: "mock",
            RAZORPAY_KEY_ID: "",
            RAZORPAY_KEY_SECRET: "",
            RAZORPAY_WEBHOOK_SECRET: "",
          },
          timeout: 120_000
        },
        {
          command: "corepack pnpm dev --hostname 127.0.0.1",
          url: webOrigin,
          reuseExistingServer: false,
          env: { NEXT_PUBLIC_API_URL: apiOrigin },
          timeout: 120_000
        }
      ]
});
