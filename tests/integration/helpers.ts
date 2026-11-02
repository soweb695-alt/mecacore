import { db } from "@/lib/db";

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const liste = tables.map((t) => `"${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);
  await db.parametreGarage.create({
    data: { id: 1, nomGarage: "Garage Test", adresse: "1 rue Test", telephone: "0102030405", email: "t@t.fr", siret: "1", tvaNumber: "FR1", horaires: {} },
  });
}

export async function seedBase() {
  const user = await db.user.create({
    data: { email: "sec@test.fr", passwordHash: "x", firstName: "Sec", lastName: "Test", role: "SECRETARIAT" },
  });
  const meca = await db.user.create({
    data: { email: "meca@test.fr", passwordHash: "x", firstName: "Meca", lastName: "Test", role: "MECANICIEN" },
  });
  const client = await db.client.create({ data: { type: "PARTICULIER", firstName: "Jean", lastName: "Durand", email: "j@d.fr" } });
  const vehicule = await db.vehicule.create({ data: { clientId: client.id, immatriculation: "AB-123-CD", marque: "Peugeot", modele: "308" } });
  const p1 = await db.piece.create({ data: { reference: "P1", nom: "Plaquettes", prixVenteHT: 50, prixAchatHT: 30, stock: 5, seuilAlerte: 2 } });
  const p2 = await db.piece.create({ data: { reference: "P2", nom: "Filtre", prixVenteHT: 10, prixAchatHT: 4, stock: 5, seuilAlerte: 2 } });
  return { user, meca, client, vehicule, p1, p2 };
}

export function ligne(pieceId: string, quantite: number, pu = 50) {
  return { type: "PIECE" as const, designation: "Pièce", quantite, prixUnitaireHT: pu, tvaRate: 20, pieceId };
}

/** Technicien + créneau de rendez-vous exigés à la validation d'un devis mécanique. */
let jourSuivant = 0;
export function creneau(mecanicienId: string) {
  // Un jour différent à chaque appel : jamais de conflit entre deux validations d'un même test.
  const jour = `2027-03-${String(1 + (jourSuivant++ % 27)).padStart(2, "0")}`;
  return { mecanicienId, rdv: { debut: `${jour}T09:00`, fin: `${jour}T10:00` } };
}
