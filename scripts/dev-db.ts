// Base PostgreSQL locale embarquée (développement et tests uniquement).
// En production, la base est Neon : voir README.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const port = Number(process.env.DEV_DB_PORT ?? 54329);

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
  });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  for (const nom of ["crm_garage", "crm_garage_test"]) {
    try {
      await pg.createDatabase(nom);
    } catch {
      /* existe déjà */
    }
  }
  console.log(`PostgreSQL local prêt : postgresql://postgres:postgres@localhost:${port}/crm_garage`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
