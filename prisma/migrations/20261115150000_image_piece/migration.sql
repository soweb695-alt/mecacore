-- Image produit (une par pièce), stockée en base dans une table dédiée.
ALTER TABLE "Piece" ADD COLUMN "imageMaj" TIMESTAMP(3);

CREATE TABLE "PieceImage" (
    "pieceId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    CONSTRAINT "PieceImage_pkey" PRIMARY KEY ("pieceId")
);

ALTER TABLE "PieceImage" ADD CONSTRAINT "PieceImage_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
