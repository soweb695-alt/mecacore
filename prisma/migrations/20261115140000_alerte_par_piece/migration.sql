-- Alerte de seuil activable par pièce (activée par défaut, y compris pour les pièces existantes).
ALTER TABLE "Piece" ADD COLUMN "alerteActive" BOOLEAN NOT NULL DEFAULT true;
