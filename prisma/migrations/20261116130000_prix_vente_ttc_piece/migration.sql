-- Prix de vente TTC de la pièce (TVA 20 %) : il fait foi, le HT en est déduit.
ALTER TABLE "Piece" ADD COLUMN "prixVenteTTC" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Pièces existantes : TTC calculé depuis le HT actuel, arrondi au centime.
UPDATE "Piece" SET "prixVenteTTC" = ROUND("prixVenteHT" * 1.2, 2);
