-- AlterTable
ALTER TABLE "LigneFacture" ADD COLUMN     "pieceId" TEXT;

-- CreateIndex
CREATE INDEX "LigneFacture_pieceId_idx" ON "LigneFacture"("pieceId");
