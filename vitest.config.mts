import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/crm_garage_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup.ts"],
    env: { DATABASE_URL: TEST_DB_URL, DIRECT_URL: TEST_DB_URL },
    fileParallelism: false,
    testTimeout: 30000,
    coverage: { provider: "v8", include: ["src/lib/**", "src/app/api/**"], exclude: ["src/generated/**", "src/lib/client-api.ts", "src/lib/utils.ts"] },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
});
