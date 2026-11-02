-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECRETARIAT', 'MECANICIEN');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('PARTICULIER', 'PRO');

-- CreateEnum
CREATE TYPE "TypeDevis" AS ENUM ('MECANIQUE', 'PIECE');

-- CreateEnum
CREATE TYPE "StatutDevis" AS ENUM ('BROUILLON', 'ENVOYE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeLigne" AS ENUM ('MAIN_OEUVRE', 'FORFAIT', 'PIECE', 'FRAIS_DIVERS');

-- CreateEnum
CREATE TYPE "StatutOrdre" AS ENUM ('EN_ATTENTE_SIGNATURE', 'SIGNE', 'EN_COURS', 'TERMINE', 'FACTURE');

-- CreateEnum
CREATE TYPE "StatutBonCommande" AS ENUM ('EN_ATTENTE', 'RECEPTIONNEE_PARTIELLE', 'RECEPTIONNEE');

-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('EMISE', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'IMPAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('CB', 'ESPECES', 'CHEQUE', 'VIREMENT', 'PLUSIEURS_FOIS');

-- CreateEnum
CREATE TYPE "StatutRdv" AS ENUM ('PLANIFIE', 'CONFIRME', 'HONORE', 'ANNULE', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TypeTarif" AS ENUM ('MO1', 'MO2', 'MO3', 'FORFAIT', 'FRAIS_DIVERS');

-- CreateEnum
CREATE TYPE "CanalMessage" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "StatutMessage" AS ENUM ('ENVOYE', 'ECHEC', 'IGNORE');

-- CreateEnum
CREATE TYPE "TypeCampagne" AS ENUM ('MANUELLE', 'AUTOMATIQUE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "type" "TypeClient" NOT NULL DEFAULT 'PARTICULIER',
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "siret" TEXT,
    "tvaNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "anonymiseLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vin" TEXT,
    "immatriculation" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "annee" INTEGER,
    "motorisation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marque" TEXT,
    "fournisseur" TEXT,
    "categorie" TEXT,
    "prixAchatHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "prixVenteHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 0,
    "taillePneu" TEXT,
    "referencesCroisees" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeDevis" NOT NULL DEFAULT 'MECANIQUE',
    "clientId" TEXT NOT NULL,
    "vehiculeId" TEXT,
    "userId" TEXT NOT NULL,
    "statut" "StatutDevis" NOT NULL DEFAULT 'BROUILLON',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidite" TIMESTAMP(3) NOT NULL,
    "remisePro" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDevis" (
    "id" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "type" "TypeLigne" NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "prixUnitaireHT" DECIMAL(10,2) NOT NULL,
    "tvaRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "totalHT" DECIMAL(10,2) NOT NULL,
    "pieceId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneDevis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdreReparation" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "userId" TEXT,
    "statut" "StatutOrdre" NOT NULL DEFAULT 'EN_ATTENTE_SIGNATURE',
    "signatureUrl" TEXT,
    "signeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdreReparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheOR" (
    "id" TEXT NOT NULL,
    "ordreId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "dureeHeures" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "terminee" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TacheOR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoOR" (
    "id" TEXT NOT NULL,
    "ordreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoOR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" TEXT NOT NULL,
    "ordreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonCommande" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "statut" "StatutBonCommande" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonCommande" (
    "id" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "quantiteRecue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneBonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonLivraison" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bonCommandeId" TEXT,
    "clientId" TEXT,
    "dateLivraison" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonLivraison" (
    "id" TEXT NOT NULL,
    "bonLivraisonId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,

    CONSTRAINT "LigneBonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "statut" "StatutFacture" NOT NULL DEFAULT 'EMISE',
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "remisePro" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalHT" DECIMAL(10,2) NOT NULL,
    "totalTVA" DECIMAL(10,2) NOT NULL,
    "totalTTC" DECIMAL(10,2) NOT NULL,
    "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "facturXUrl" TEXT,
    "statutPA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneFacture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "type" "TypeLigne" NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "prixUnitaireHT" DECIMAL(10,2) NOT NULL,
    "tvaRate" DECIMAL(5,2) NOT NULL,
    "totalHT" DECIMAL(10,2) NOT NULL,
    "prixAchatHT" DECIMAL(10,2),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneFacture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehiculeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "statut" "StatutRdv" NOT NULL DEFAULT 'PLANIFIE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarif" (
    "id" TEXT NOT NULL,
    "type" "TypeTarif" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantHT" DECIMAL(10,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tarif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "canal" "CanalMessage" NOT NULL,
    "template" TEXT NOT NULL,
    "statut" "StatutMessage" NOT NULL,
    "contenu" TEXT,
    "destinataire" TEXT,
    "cle" TEXT,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campagne" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeCampagne" NOT NULL,
    "template" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "declencheur" TEXT,
    "joursAvant" INTEGER,
    "canal" "CanalMessage" NOT NULL DEFAULT 'SMS',

    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametreGarage" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nomGarage" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "tvaNumber" TEXT NOT NULL,
    "horaires" JSONB NOT NULL,
    "prefixDevis" TEXT NOT NULL DEFAULT 'DEV',
    "prefixFacture" TEXT NOT NULL DEFAULT 'FAC',
    "prefixOrdre" TEXT NOT NULL DEFAULT 'OR',
    "prefixBonCommande" TEXT NOT NULL DEFAULT 'BC',
    "prefixBonLivraison" TEXT NOT NULL DEFAULT 'BL',
    "retentionClientsAns" INTEGER NOT NULL DEFAULT 5,
    "retentionMessagesAns" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "ParametreGarage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compteur" (
    "type" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Compteur_pkey" PRIMARY KEY ("type","annee")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Client_lastName_idx" ON "Client"("lastName");

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicule_immatriculation_key" ON "Vehicule"("immatriculation");

-- CreateIndex
CREATE INDEX "Vehicule_clientId_idx" ON "Vehicule"("clientId");

-- CreateIndex
CREATE INDEX "Vehicule_vin_idx" ON "Vehicule"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Piece_reference_key" ON "Piece"("reference");

-- CreateIndex
CREATE INDEX "Piece_nom_idx" ON "Piece"("nom");

-- CreateIndex
CREATE INDEX "Piece_categorie_idx" ON "Piece"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "Devis_numero_key" ON "Devis"("numero");

-- CreateIndex
CREATE INDEX "Devis_clientId_idx" ON "Devis"("clientId");

-- CreateIndex
CREATE INDEX "Devis_statut_idx" ON "Devis"("statut");

-- CreateIndex
CREATE INDEX "Devis_dateCreation_idx" ON "Devis"("dateCreation");

-- CreateIndex
CREATE INDEX "LigneDevis_devisId_idx" ON "LigneDevis"("devisId");

-- CreateIndex
CREATE INDEX "LigneDevis_pieceId_idx" ON "LigneDevis"("pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdreReparation_numero_key" ON "OrdreReparation"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "OrdreReparation_devisId_key" ON "OrdreReparation"("devisId");

-- CreateIndex
CREATE INDEX "OrdreReparation_userId_idx" ON "OrdreReparation"("userId");

-- CreateIndex
CREATE INDEX "OrdreReparation_statut_idx" ON "OrdreReparation"("statut");

-- CreateIndex
CREATE INDEX "TacheOR_ordreId_idx" ON "TacheOR"("ordreId");

-- CreateIndex
CREATE INDEX "PhotoOR_ordreId_idx" ON "PhotoOR"("ordreId");

-- CreateIndex
CREATE INDEX "Pointage_ordreId_idx" ON "Pointage"("ordreId");

-- CreateIndex
CREATE INDEX "Pointage_userId_fin_idx" ON "Pointage"("userId", "fin");

-- CreateIndex
CREATE UNIQUE INDEX "BonCommande_numero_key" ON "BonCommande"("numero");

-- CreateIndex
CREATE INDEX "LigneBonCommande_bonCommandeId_idx" ON "LigneBonCommande"("bonCommandeId");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_numero_key" ON "BonLivraison"("numero");

-- CreateIndex
CREATE INDEX "BonLivraison_clientId_idx" ON "BonLivraison"("clientId");

-- CreateIndex
CREATE INDEX "BonLivraison_bonCommandeId_idx" ON "BonLivraison"("bonCommandeId");

-- CreateIndex
CREATE INDEX "LigneBonLivraison_bonLivraisonId_idx" ON "LigneBonLivraison"("bonLivraisonId");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_numero_key" ON "Facture"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_devisId_key" ON "Facture"("devisId");

-- CreateIndex
CREATE INDEX "Facture_clientId_idx" ON "Facture"("clientId");

-- CreateIndex
CREATE INDEX "Facture_statut_idx" ON "Facture"("statut");

-- CreateIndex
CREATE INDEX "Facture_dateEcheance_idx" ON "Facture"("dateEcheance");

-- CreateIndex
CREATE INDEX "LigneFacture_factureId_idx" ON "LigneFacture"("factureId");

-- CreateIndex
CREATE INDEX "Paiement_factureId_idx" ON "Paiement"("factureId");

-- CreateIndex
CREATE INDEX "RendezVous_userId_debut_fin_idx" ON "RendezVous"("userId", "debut", "fin");

-- CreateIndex
CREATE INDEX "RendezVous_debut_idx" ON "RendezVous"("debut");

-- CreateIndex
CREATE INDEX "Tarif_type_idx" ON "Tarif"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_cle_key" ON "MessageLog"("cle");

-- CreateIndex
CREATE INDEX "MessageLog_clientId_idx" ON "MessageLog"("clientId");

-- CreateIndex
CREATE INDEX "MessageLog_envoyeLe_idx" ON "MessageLog"("envoyeLe");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevis" ADD CONSTRAINT "LigneDevis_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevis" ADD CONSTRAINT "LigneDevis_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreReparation" ADD CONSTRAINT "OrdreReparation_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreReparation" ADD CONSTRAINT "OrdreReparation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheOR" ADD CONSTRAINT "TacheOR_ordreId_fkey" FOREIGN KEY ("ordreId") REFERENCES "OrdreReparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoOR" ADD CONSTRAINT "PhotoOR_ordreId_fkey" FOREIGN KEY ("ordreId") REFERENCES "OrdreReparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoOR" ADD CONSTRAINT "PhotoOR_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_ordreId_fkey" FOREIGN KEY ("ordreId") REFERENCES "OrdreReparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneFacture" ADD CONSTRAINT "LigneFacture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
