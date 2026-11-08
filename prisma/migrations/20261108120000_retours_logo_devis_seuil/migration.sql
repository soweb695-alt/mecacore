-- CreateEnum
CREATE TYPE "TypeRetour" AS ENUM ('PIECE_DEPOSEE', 'CONSIGNE');

-- CreateEnum
CREATE TYPE "StatutRetour" AS ENUM ('EN_ATTENTE', 'RENVOYEE_FOURNISSEUR', 'REMBOURSEE', 'RENDUE_CLIENT', 'CLOTUREE');

-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "priseEnCompteSeuil" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ParametreGarage" ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMaj" TIMESTAMP(3),
ADD COLUMN     "logoMime" TEXT;

-- CreateTable
CREATE TABLE "RetourPiece" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeRetour" NOT NULL,
    "statut" "StatutRetour" NOT NULL DEFAULT 'EN_ATTENTE',
    "designation" TEXT NOT NULL,
    "reference" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "montantConsigneHT" DECIMAL(10,2),
    "fournisseur" TEXT,
    "notes" TEXT,
    "pieceId" TEXT,
    "clientId" TEXT,
    "ordreId" TEXT,
    "userId" TEXT NOT NULL,
    "dateEntree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTraitement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetourPiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetourPiece_numero_key" ON "RetourPiece"("numero");

-- CreateIndex
CREATE INDEX "RetourPiece_statut_idx" ON "RetourPiece"("statut");

-- CreateIndex
CREATE INDEX "RetourPiece_type_idx" ON "RetourPiece"("type");

-- CreateIndex
CREATE INDEX "RetourPiece_clientId_idx" ON "RetourPiece"("clientId");

-- CreateIndex
CREATE INDEX "RetourPiece_ordreId_idx" ON "RetourPiece"("ordreId");

-- AddForeignKey
ALTER TABLE "RetourPiece" ADD CONSTRAINT "RetourPiece_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourPiece" ADD CONSTRAINT "RetourPiece_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourPiece" ADD CONSTRAINT "RetourPiece_ordreId_fkey" FOREIGN KEY ("ordreId") REFERENCES "OrdreReparation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourPiece" ADD CONSTRAINT "RetourPiece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
