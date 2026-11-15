-- Le prix unitaire TTC saisi fait foi : HT et TVA de la ligne en sont déduits (corrige 35,00 € affiché 34,99 €).
ALTER TABLE "LigneDevis" ADD COLUMN "prixUnitaireTTC" DECIMAL(10,2);
ALTER TABLE "LigneFacture" ADD COLUMN "prixUnitaireTTC" DECIMAL(10,2);
