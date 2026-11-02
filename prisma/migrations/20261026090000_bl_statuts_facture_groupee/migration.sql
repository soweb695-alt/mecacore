-- CreateEnum
CREATE TYPE "StatutLivraison" AS ENUM ('EN_ATTENTE', 'PRETE', 'LIVREE');

-- AlterTable : le booléen « prete » est remplacé par un statut (les bons déjà prêts sont conservés)
ALTER TABLE "BonLivraison"
ADD COLUMN     "factureId" TEXT,
ADD COLUMN     "livreLe" TIMESTAMP(3),
ADD COLUMN     "statut" "StatutLivraison" NOT NULL DEFAULT 'EN_ATTENTE';

UPDATE "BonLivraison" SET "statut" = 'PRETE' WHERE "prete" = true;

ALTER TABLE "BonLivraison" DROP COLUMN "prete";

-- AlterTable : une facture peut regrouper plusieurs bons de livraison (plus de devis unique obligatoire)
ALTER TABLE "Facture" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "devisId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BonLivraison_factureId_idx" ON "BonLivraison"("factureId");

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
