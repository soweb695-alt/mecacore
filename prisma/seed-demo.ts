// Données de démonstration (développement uniquement) : clients, véhicules, pièces.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refus : le jeu de démonstration ne doit pas être chargé en production.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });

async function main() {
  const clients = [
    { type: "PARTICULIER" as const, firstName: "Sophie", lastName: "Leroy", email: "sophie.leroy@example.com", phone: "06 12 34 56 78", marketingOptIn: true, vehicule: { immatriculation: "AB-123-CD", marque: "Peugeot", modele: "308", annee: 2019, motorisation: "1.5 BlueHDi 130" } },
    { type: "PRO" as const, companyName: "Transports Moreau", lastName: "Moreau", firstName: "Luc", siret: "81234567800019", email: "contact@moreau.example.com", phone: "04 78 11 22 33", discountRate: 10, paymentTerms: 45, vehicule: { immatriculation: "EF-456-GH", marque: "Renault", modele: "Trafic", annee: 2021, motorisation: "2.0 dCi 145" } },
    { type: "PARTICULIER" as const, firstName: "Jean", lastName: "Durand", email: "j.durand@example.com", phone: "06 98 76 54 32", vehicule: { immatriculation: "MN-852-QR", marque: "Renault", modele: "Clio", annee: 2015, motorisation: "0.9 TCe 90" } },
    { type: "PARTICULIER" as const, firstName: "Paul", lastName: "Bernard", email: "p.bernard@example.com", phone: "07 11 22 33 44", vehicule: { immatriculation: "IJ-789-KL", marque: "Citroën", modele: "C3", annee: 2018, motorisation: "1.2 PureTech 82" } },
  ];
  for (const { vehicule, ...c } of clients) {
    const existe = await db.vehicule.findUnique({ where: { immatriculation: vehicule.immatriculation } });
    if (existe) continue;
    await db.client.create({ data: { ...c, vehicules: { create: vehicule } } });
  }

  const pieces = [
    { reference: "BSH-0986494", nom: "Plaquettes avant Bosch", marque: "Bosch", fournisseur: "Autodis", categorie: "Freinage", prixAchatHT: 28.4, prixVenteHT: 49.9, stock: 2, seuilAlerte: 5, referencesCroisees: ["TRW GDB1550", "ATE 13.0460"] },
    { reference: "MAN-W712", nom: "Filtre à huile MANN W712", marque: "MANN", fournisseur: "Autodis", categorie: "Filtration", prixAchatHT: 4.1, prixVenteHT: 9.9, stock: 1, seuilAlerte: 4, referencesCroisees: [] },
    { reference: "CAS-5W30-5L", nom: "Huile Castrol 5W30 5 L", marque: "Castrol", fournisseur: "Distrimo", categorie: "Lubrifiants", prixAchatHT: 31, prixVenteHT: 54, stock: 18, seuilAlerte: 6, referencesCroisees: [] },
    { reference: "MIC-2055516", nom: "Pneu Michelin 205/55 R16", marque: "Michelin", fournisseur: "Euromaster", categorie: "Pneumatiques", prixAchatHT: 74, prixVenteHT: 112, stock: 12, seuilAlerte: 4, taillePneu: "205/55 R16", referencesCroisees: [] },
    { reference: "BSH-DISQ-308", nom: "Disques de frein avant (paire)", marque: "Bosch", fournisseur: "Autodis", categorie: "Freinage", prixAchatHT: 96, prixVenteHT: 189, stock: 6, seuilAlerte: 2, referencesCroisees: [] },
  ];
  for (const p of pieces) await db.piece.upsert({ where: { reference: p.reference }, update: {}, create: p });
  console.log("Données de démonstration chargées.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
