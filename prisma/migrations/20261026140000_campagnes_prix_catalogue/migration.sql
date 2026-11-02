-- AlterTable
ALTER TABLE "Campagne" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'TOUS',
ADD COLUMN     "contenu" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "envoyeeLe" TIMESTAMP(3),
ADD COLUMN     "nbDestinataires" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nbEchecs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nbEnvoyes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sujet" TEXT;

-- AlterTable
ALTER TABLE "LigneDevis" ADD COLUMN     "prixCatalogueHT" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "LigneFacture" ADD COLUMN     "prixCatalogueHT" DECIMAL(10,2);

