-- AlterEnum
ALTER TYPE "StatutFacture" ADD VALUE 'BROUILLON';

-- AlterEnum : les OR « Terminé » deviennent « À traiter par le Magasin » (valeurs conservées)
ALTER TYPE "StatutOrdre" RENAME VALUE 'TERMINE' TO 'A_TRAITER_MAGASIN';

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "kilometrage" INTEGER,
ALTER COLUMN "numero" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LigneDevis" ADD COLUMN     "composition" JSONB,
ADD COLUMN     "tarifId" TEXT;

-- AlterTable
ALTER TABLE "LigneFacture" ADD COLUMN     "composition" JSONB;

-- AlterTable
ALTER TABLE "OrdreReparation" ADD COLUMN     "kilometrage" INTEGER;

-- AlterTable
ALTER TABLE "ParametreGarage" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Tarif" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "TarifPiece" (
    "id" TEXT NOT NULL,
    "tarifId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TarifPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelanceFacture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "userId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelanceFacture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TarifPiece_pieceId_idx" ON "TarifPiece"("pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifPiece_tarifId_pieceId_key" ON "TarifPiece"("tarifId", "pieceId");

-- CreateIndex
CREATE INDEX "RelanceFacture_factureId_idx" ON "RelanceFacture"("factureId");

-- AddForeignKey
ALTER TABLE "LigneDevis" ADD CONSTRAINT "LigneDevis_tarifId_fkey" FOREIGN KEY ("tarifId") REFERENCES "Tarif"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifPiece" ADD CONSTRAINT "TarifPiece_tarifId_fkey" FOREIGN KEY ("tarifId") REFERENCES "Tarif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifPiece" ADD CONSTRAINT "TarifPiece_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelanceFacture" ADD CONSTRAINT "RelanceFacture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelanceFacture" ADD CONSTRAINT "RelanceFacture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


