// Commandes sur la base de PRODUCTION (Neon), depuis le poste local.
//   npm run prod:migrate   → applique les migrations Prisma sur Neon
//   npm run prod:seed      → crée les comptes de départ, les tarifs et les paramètres (rejouable sans rien écraser)
// Les URL viennent de NEON_DIRECT_URL / NEON_DATABASE_URL dans .env ; la base locale (DATABASE_URL) n'est jamais touchée.
// Le seed génère des mots de passe neufs (ceux de développement du .env ne sont jamais repris) et les affiche une seule fois.
import "dotenv/config";
import { spawnSync } from "node:child_process";

const action = process.argv[2];
const direct = process.env.NEON_DIRECT_URL;
if (!direct || !process.env.NEON_DATABASE_URL) {
  console.error("NEON_DIRECT_URL et NEON_DATABASE_URL doivent être définies dans .env.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct };
let commande;
if (action === "migrate") {
  commande = ["prisma", "migrate", "deploy"];
} else if (action === "seed") {
  for (const role of ["ADMIN", "SECRETARIAT", "MECANICIEN"]) {
    if (!process.env[`PROD_${role}_EMAIL`]) {
      console.error(`Indiquez l'e-mail du compte ${role} : PROD_${role}_EMAIL="…" npm run prod:seed`);
      process.exit(1);
    }
    env[`SEED_${role}_EMAIL`] = process.env[`PROD_${role}_EMAIL`];
    env[`SEED_${role}_PASSWORD`] = ""; // vide → mot de passe aléatoire affiché une fois
  }
  commande = ["prisma", "db", "seed"];
} else {
  console.error("Usage : node scripts/prod-db.mjs migrate|seed");
  process.exit(1);
}

console.log(`→ Base de production Neon : ${new URL(direct).host}`);
const r = spawnSync("npx", commande, { stdio: "inherit", env });
process.exit(r.status ?? 1);
