-- Remise globale sur le devis (reprise sur la facture).
ALTER TABLE "Devis" ADD COLUMN "remiseGlobaleType" "TypeRemise",
  ADD COLUMN "remiseGlobaleBase" "BaseRemise",
  ADD COLUMN "remiseGlobaleValeur" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "remiseGlobaleMontant" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalHTAvantRemise" DECIMAL(10,2);
