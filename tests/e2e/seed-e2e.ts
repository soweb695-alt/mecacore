import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { E2E } from "./credentials";

/** Base de test propre : comptes, tarifs, pièce de test (exécuté via tsx par global-setup). */
async function main() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/crm_garage_test";
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    const hash = (p: string) => bcrypt.hash(p, 12);
    await db.user.createMany({
      data: [
        { email: E2E.admin.email, passwordHash: await hash(E2E.admin.password), firstName: "Karim", lastName: "Martin", role: "ADMIN" },
        { email: E2E.secretariat.email, passwordHash: await hash(E2E.secretariat.password), firstName: "Nadia", lastName: "Roux", role: "SECRETARIAT" },
        { email: E2E.mecanicien.email, passwordHash: await hash(E2E.mecanicien.password), firstName: "Youssef", lastName: "Amrani", role: "MECANICIEN" },
      ],
    });
    await db.parametreGarage.create({
      data: { id: 1, nomGarage: "Garage E2E", adresse: "1 rue du Test, 69000 Lyon", telephone: "04 00 00 00 00", email: "e2e@garage.test", siret: "000 000 000 00000", tvaNumber: "FR00000000000", horaires: {} },
    });
    await db.tarif.create({ data: { type: "MO2", libelle: "Main d'œuvre niveau 2", montantHT: 65 } });
    await db.pointControle.createMany({ data: ["Freins", "Pneumatiques", "Éclairage"].map((libelle, position) => ({ libelle, position })) });
    await db.piece.create({ data: { reference: "E2E-PLAQ", nom: "Plaquettes E2E", prixAchatHT: 28.4, prixVenteHT: 50, stock: 5, seuilAlerte: 2 } });
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
