-- DropForeignKey
ALTER TABLE "Vehicule" DROP CONSTRAINT "Vehicule_clientId_fkey";

-- AlterTable
ALTER TABLE "BonCommande" ADD COLUMN     "automatique" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BonLivraison" ADD COLUMN     "devisId" TEXT;

-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "kilometrage" INTEGER;

-- AlterTable
ALTER TABLE "LigneBonLivraison" ADD COLUMN     "designation" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "pieceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "nombreFois" INTEGER;

-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "devisId" TEXT;

-- AlterTable
ALTER TABLE "Vehicule" ADD COLUMN     "kilometrage" INTEGER,
ADD COLUMN     "prochainCT" TIMESTAMP(3),
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_devisId_key" ON "BonLivraison"("devisId");

-- CreateIndex
CREATE INDEX "RendezVous_devisId_idx" ON "RendezVous"("devisId");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

