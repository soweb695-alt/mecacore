import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    // DIRECT_URL (connexion directe Neon, sans pooler) pour les migrations ;
    // repli sur DATABASE_URL en local.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
