-- CreateEnum
CREATE TYPE "TypeRemise" AS ENUM ('EUROS', 'POURCENT');

-- CreateEnum
CREATE TYPE "BaseRemise" AS ENUM ('HT', 'TTC');

-- CreateEnum
CREATE TYPE "StatutFiche" AS ENUM ('EN_COURS', 'TRANSMISE', 'TRAITEE');

-- CreateEnum
CREATE TYPE "ResultatControle" AS ENUM ('NON_VERIFIE', 'OK', 'A_SURVEILLER', 'DEFAUT');

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "manuelle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modePaiement" "ModePaiement",
ADD COLUMN     "remiseGlobaleBase" "BaseRemise",
ADD COLUMN     "remiseGlobaleMontant" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "remiseGlobaleType" "TypeRemise",
ADD COLUMN     "remiseGlobaleValeur" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalHTAvantRemise" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ParametreGarage" ADD COLUMN     "bic" TEXT,
ADD COLUMN     "iban" TEXT;

-- CreateTable
CREATE TABLE "PointControle" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PointControle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheControle" (
    "id" TEXT NOT NULL,
    "ordreId" TEXT NOT NULL,
    "statut" "StatutFiche" NOT NULL DEFAULT 'EN_COURS',
    "remarques" TEXT,
    "valideeLe" TIMESTAMP(3),
    "valideeParId" TEXT,
    "traiteeLe" TIMESTAMP(3),
    "traiteeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FicheControle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointFiche" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "resultat" "ResultatControle" NOT NULL DEFAULT 'NON_VERIFIE',

    CONSTRAINT "PointFiche_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FicheControle_ordreId_key" ON "FicheControle"("ordreId");

-- CreateIndex
CREATE INDEX "FicheControle_statut_idx" ON "FicheControle"("statut");

-- CreateIndex
CREATE INDEX "PointFiche_ficheId_idx" ON "PointFiche"("ficheId");

-- AddForeignKey
ALTER TABLE "FicheControle" ADD CONSTRAINT "FicheControle_ordreId_fkey" FOREIGN KEY ("ordreId") REFERENCES "OrdreReparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheControle" ADD CONSTRAINT "FicheControle_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheControle" ADD CONSTRAINT "FicheControle_traiteeParId_fkey" FOREIGN KEY ("traiteeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointFiche" ADD CONSTRAINT "PointFiche_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "FicheControle"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Points de contrôle proposés par défaut (modifiables par l'administrateur).
INSERT INTO "PointControle" ("id", "libelle", "position") VALUES
  ('pc_freins', 'Freins (plaquettes, disques, liquide)', 0),
  ('pc_pneus', 'Pneumatiques (usure, pression)', 1),
  ('pc_eclairage', 'Éclairage et signalisation', 2),
  ('pc_niveaux', 'Niveaux (huile, refroidissement, lave-glace)', 3),
  ('pc_direction', 'Direction et suspension', 4),
  ('pc_echappement', 'Échappement', 5),
  ('pc_batterie', 'Batterie', 6),
  ('pc_essai', 'Essai routier', 7);
