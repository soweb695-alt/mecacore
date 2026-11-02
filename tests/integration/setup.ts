import { execSync } from "node:child_process";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/crm_garage_test";

/** Applique les migrations sur la base de test avant les tests d'intégration. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, DIRECT_URL: TEST_DB_URL },
  });
}
