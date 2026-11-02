import { execSync } from "node:child_process";

/** Applique les migrations puis réinitialise la base de test (script tsx : le client Prisma est en ESM). */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/crm_garage_test";
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  execSync("npx tsx tests/e2e/seed-e2e.ts", { stdio: "pipe", env });
}
