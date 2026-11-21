-- CreateEnum
CREATE TYPE "TypeStatutsControle" AS ENUM ('OK_ABIME', 'OK_NC', 'OK_A_REPARER', 'CASE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResultatControle" ADD VALUE 'ABIME';
ALTER TYPE "ResultatControle" ADD VALUE 'NON_CONFORME';
ALTER TYPE "ResultatControle" ADD VALUE 'A_REPARER';
ALTER TYPE "ResultatControle" ADD VALUE 'NON_CONCERNE';

-- AlterTable
ALTER TABLE "FicheControle" ADD COLUMN     "dommages" JSONB,
ADD COLUMN     "examinantNom" TEXT,
ADD COLUMN     "examinantPrenom" TEXT,
ADD COLUMN     "examinantSignature" BYTEA,
ADD COLUMN     "responsableNom" TEXT,
ADD COLUMN     "responsableSignature" BYTEA,
ADD COLUMN     "verifieeLe" TIMESTAMP(3),
ADD COLUMN     "verifieeParId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "PointControle" ADD COLUMN     "categorieId" TEXT;

-- AlterTable
ALTER TABLE "PointFiche" ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "categoriePosition" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "typeStatuts" "TypeStatutsControle";

-- CreateTable
CREATE TABLE "CategorieControle" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "typeStatuts" "TypeStatutsControle" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategorieControle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointControle_categorieId_idx" ON "PointControle"("categorieId");

-- AddForeignKey
ALTER TABLE "PointControle" ADD CONSTRAINT "PointControle_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieControle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fiches déjà créées : ancien modèle (liste simple), conservées telles quelles.
UPDATE "FicheControle" SET "version" = 1;

-- Nouveau modèle : l'ancienne liste de points est remplacée par les catégories ci-dessous (modifiables dans Paramètres).
DELETE FROM "PointControle";

INSERT INTO "CategorieControle" ("id", "libelle", "typeStatuts", "position") VALUES
  ('cc_pneus', 'État des pneus', 'OK_ABIME', 0),
  ('cc_niveaux', 'Contrôle des niveaux', 'OK_NC', 1),
  ('cc_elements', 'Éléments du véhicule', 'OK_A_REPARER', 2),
  ('cc_papiers', 'Papiers / accessoires de bord', 'CASE', 3);

INSERT INTO "PointControle" ("id", "libelle", "position", "categorieId") VALUES
  ('cc_pneus_1', 'Pneu AV/G', 0, 'cc_pneus'),
  ('cc_pneus_2', 'Pneu AV/D', 1, 'cc_pneus'),
  ('cc_pneus_3', 'Pneu AR/G', 2, 'cc_pneus'),
  ('cc_pneus_4', 'Pneu AR/D', 3, 'cc_pneus'),
  ('cc_niveaux_1', 'Niveau d''huile', 0, 'cc_niveaux'),
  ('cc_niveaux_2', 'Niveau d''eau', 1, 'cc_niveaux'),
  ('cc_niveaux_3', 'Niveau de lave-glace', 2, 'cc_niveaux'),
  ('cc_niveaux_4', 'Plaquettes de freins', 3, 'cc_niveaux'),
  ('cc_niveaux_5', 'Carburant', 4, 'cc_niveaux'),
  ('cc_elements_1', 'Phare avant', 0, 'cc_elements'),
  ('cc_elements_2', 'Antibrouillard', 1, 'cc_elements'),
  ('cc_elements_3', 'Clignotant', 2, 'cc_elements'),
  ('cc_elements_4', 'Feu de stop', 3, 'cc_elements'),
  ('cc_elements_5', 'Feu de recul', 4, 'cc_elements'),
  ('cc_elements_6', 'Vitre avant', 5, 'cc_elements'),
  ('cc_elements_7', 'Vitre arrière', 6, 'cc_elements'),
  ('cc_elements_8', 'Rétroviseur D', 7, 'cc_elements'),
  ('cc_elements_9', 'Rétroviseur G', 8, 'cc_elements'),
  ('cc_elements_10', 'Gyrophare de recul', 9, 'cc_elements'),
  ('cc_elements_11', 'Fanion', 10, 'cc_elements'),
  ('cc_papiers_1', 'Carte grise', 0, 'cc_papiers'),
  ('cc_papiers_2', 'Assurance', 1, 'cc_papiers'),
  ('cc_papiers_3', 'Contrôle technique', 2, 'cc_papiers'),
  ('cc_papiers_4', 'Cric', 3, 'cc_papiers'),
  ('cc_papiers_5', 'Roue de secours', 4, 'cc_papiers'),
  ('cc_papiers_6', 'Boîte à pharmacie', 5, 'cc_papiers'),
  ('cc_papiers_7', 'KIT (extincteur, triangle, gilet)', 6, 'cc_papiers');
