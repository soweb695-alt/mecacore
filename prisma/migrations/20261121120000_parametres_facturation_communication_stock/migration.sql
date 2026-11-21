-- CreateEnum
CREATE TYPE "AffichageRemise" AS ENUM ('LIGNE', 'TOTAL', 'MASQUER');

-- AlterTable
ALTER TABLE "ParametreGarage" ADD COLUMN     "affichageRemise" "AffichageRemise" NOT NULL DEFAULT 'LIGNE',
ADD COLUMN     "delaiPaiementDefaut" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "expediteurEmail" TEXT,
ADD COLUMN     "expediteurNom" TEXT,
ADD COLUMN     "mentionsFacture" TEXT,
ADD COLUMN     "modesPaiement" "ModePaiement"[] DEFAULT ARRAY['CB', 'ESPECES', 'CHEQUE', 'VIREMENT', 'PLUSIEURS_FOIS']::"ModePaiement"[],
ADD COLUMN     "seuilAlerteDefaut" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "CategoriePiece" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoriePiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriePiece_libelle_key" ON "CategoriePiece"("libelle");

-- Catégories par défaut, plus celles déjà utilisées sur des pièces (la liste déroulante les propose toutes).
INSERT INTO "CategoriePiece" ("id", "libelle", "position") VALUES
  ('cat_filtration', 'Filtration', 0),
  ('cat_freinage', 'Freinage', 1),
  ('cat_pneus', 'Pneus', 2),
  ('cat_batterie', 'Batterie', 3),
  ('cat_direction', 'Direction', 4),
  ('cat_eclairage', 'Éclairage', 5)
ON CONFLICT ("libelle") DO NOTHING;

INSERT INTO "CategoriePiece" ("id", "libelle", "position")
SELECT 'cat_' || md5(c.categorie), c.categorie, 100 + ROW_NUMBER() OVER (ORDER BY c.categorie)
FROM (SELECT DISTINCT TRIM("categorie") AS categorie FROM "Piece" WHERE "categorie" IS NOT NULL AND TRIM("categorie") <> '') c
ON CONFLICT ("libelle") DO NOTHING;

-- Modèles d'e-mails : variables {client} → {{client_nom}} (nouvelle syntaxe des Paramètres › Communication).
UPDATE "ParametreGarage" SET
  "emailVehiculePretSujet" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("emailVehiculePretSujet", '{client}', '{{client_nom}}'), '{vehicule}', '{{vehicule}}'), '{immatriculation}', '{{immatriculation}}'), '{garage}', '{{garage_nom}}'), '{adresse}', '{{garage_adresse}}'), '{telephone}', '{{garage_telephone}}'), '{horaires}', '{{horaires}}'), '{date}', '{{date_rdv}}'), '{heure}', '{{heure_rdv}}'),
  "emailVehiculePretCorps" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("emailVehiculePretCorps", '{client}', '{{client_nom}}'), '{vehicule}', '{{vehicule}}'), '{immatriculation}', '{{immatriculation}}'), '{garage}', '{{garage_nom}}'), '{adresse}', '{{garage_adresse}}'), '{telephone}', '{{garage_telephone}}'), '{horaires}', '{{horaires}}'), '{date}', '{{date_rdv}}'), '{heure}', '{{heure_rdv}}'),
  "emailRappelRdvSujet" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("emailRappelRdvSujet", '{client}', '{{client_nom}}'), '{vehicule}', '{{vehicule}}'), '{immatriculation}', '{{immatriculation}}'), '{garage}', '{{garage_nom}}'), '{adresse}', '{{garage_adresse}}'), '{telephone}', '{{garage_telephone}}'), '{horaires}', '{{horaires}}'), '{date}', '{{date_rdv}}'), '{heure}', '{{heure_rdv}}'),
  "emailRappelRdvCorps" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("emailRappelRdvCorps", '{client}', '{{client_nom}}'), '{vehicule}', '{{vehicule}}'), '{immatriculation}', '{{immatriculation}}'), '{garage}', '{{garage_nom}}'), '{adresse}', '{{garage_adresse}}'), '{telephone}', '{{garage_telephone}}'), '{horaires}', '{{horaires}}'), '{date}', '{{date_rdv}}'), '{heure}', '{{heure_rdv}}');
