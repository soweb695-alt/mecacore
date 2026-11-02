import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/crm_garage_test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "fr-FR", timezoneId: "Europe/Paris", viewport: { width: 1366, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      DIRECT_URL: TEST_DB,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      NEXTAUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
      CRON_SECRET: "e2e-cron-secret-123456",
    },
  },
});
