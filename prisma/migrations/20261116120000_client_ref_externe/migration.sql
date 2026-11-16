-- Identifiant du client dans le logiciel d'origine (import Pennylane) : un réimport met à jour la même fiche.
ALTER TABLE "Client" ADD COLUMN "refExterne" TEXT;
CREATE UNIQUE INDEX "Client_refExterne_key" ON "Client"("refExterne");
