import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });

function motDePasse(envKey: string): { value: string; generated: boolean } {
  const fourni = process.env[envKey];
  if (fourni && fourni.length >= 12) return { value: fourni, generated: false };
  return { value: randomBytes(12).toString("base64url"), generated: true };
}

async function main() {
  const comptes: { role: Role; email: string; firstName: string; lastName: string; pwdKey: string }[] = [
    { role: "ADMIN", email: process.env.SEED_ADMIN_EMAIL ?? "admin@garage.local", firstName: "Karim", lastName: "Martin", pwdKey: "SEED_ADMIN_PASSWORD" },
    { role: "SECRETARIAT", email: process.env.SEED_SECRETARIAT_EMAIL ?? "secretariat@garage.local", firstName: "Nadia", lastName: "Roux", pwdKey: "SEED_SECRETARIAT_PASSWORD" },
    { role: "MECANICIEN", email: process.env.SEED_MECANICIEN_EMAIL ?? "mecanicien@garage.local", firstName: "Youssef", lastName: "Amrani", pwdKey: "SEED_MECANICIEN_PASSWORD" },
  ];

  for (const c of comptes) {
    const existant = await db.user.findUnique({ where: { email: c.email.toLowerCase() } });
    if (existant) {
      console.log(`= ${c.role} déjà présent (${c.email}), mot de passe inchangé`);
      continue;
    }
    const pwd = motDePasse(c.pwdKey);
    await db.user.create({
      data: {
        email: c.email.toLowerCase(),
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        passwordHash: await bcrypt.hash(pwd.value, 12),
      },
    });
    // Affiché une seule fois dans le terminal, jamais écrit sur disque.
    console.log(`+ ${c.role} créé : ${c.email} / ${pwd.generated ? pwd.value + "  (généré, à noter maintenant)" : "(mot de passe défini dans l'environnement)"}`);
  }

  await db.parametreGarage.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nomGarage: "Garage Martin",
      adresse: "12 rue de l'Atelier, 69000 Lyon",
      telephone: "04 78 00 00 00",
      email: "contact@garage-martin.fr",
      siret: "000 000 000 00000",
      tvaNumber: "FR00000000000",
      horaires: {
        lundi: "08:00-18:00", mardi: "08:00-18:00", mercredi: "08:00-18:00",
        jeudi: "08:00-18:00", vendredi: "08:00-18:00", samedi: "09:00-12:00", dimanche: "fermé",
      },
    },
  });

  if ((await db.tarif.count()) === 0) {
    await db.tarif.createMany({
      data: [
        { type: "MO1", libelle: "Main d'œuvre niveau 1 (à ajuster)", montantHT: 50 },
        { type: "MO2", libelle: "Main d'œuvre niveau 2 (à ajuster)", montantHT: 65 },
        { type: "MO3", libelle: "Main d'œuvre niveau 3 (à ajuster)", montantHT: 85 },
        { type: "FORFAIT", libelle: "Forfait vidange (à ajuster)", montantHT: 39 },
        { type: "FORFAIT", libelle: "Forfait diagnostic électronique (à ajuster)", montantHT: 45 },
        { type: "FRAIS_DIVERS", libelle: "Participation environnement", montantHT: 3.5 },
      ],
    });
  }

  if ((await db.campagne.count()) === 0) {
    await db.campagne.createMany({
      data: [
        { nom: "Rappel rendez-vous J-7", type: "AUTOMATIQUE", template: "rdv_rappel_j7", declencheur: "RDV_J7", joursAvant: 7, canal: "EMAIL" },
        { nom: "Rappel rendez-vous J-1", type: "AUTOMATIQUE", template: "rdv_rappel_j1", declencheur: "RDV_J1", joursAvant: 1, canal: "SMS" },
      ],
    });
  }
  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
