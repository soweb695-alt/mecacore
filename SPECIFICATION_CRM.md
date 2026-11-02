# SPÉCIFICATION CRM GARAGE — MÉCANIQUE & PIÈCE AUTO

> À lire par l'agent de développement (Claude Code) avant toute action.
> Ce document est la source de vérité du projet. Toute décision non couverte ici doit être remontée à l'utilisateur avant implémentation.

## 1. CONTEXTE

Garage automobile français (mécanique + vente de pièces détachées), 5 à 10 utilisateurs.
Objectif : remplacer les processus manuels (papier, Excel, doubles saisies) par un CRM web sur mesure.

Utilisateurs cibles :
- Admin (patron) : accès total, y compris marges et utilisateurs.
- Secrétariat : devis, clients, factures, planning. Pas d'accès aux marges ni à la gestion des utilisateurs.
- Mécanicien : consultation des OR sur tablette, pointage des tâches, photos. Pas d'accès aux prix d'achat ni aux marges.

Langue de l'interface : français (France). Devise : EUR. Fuseau horaire : Europe/Paris.

## 2. STACK TECHNIQUE IMPOSÉE

- Frontend : Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Backend : Next.js API Routes (ou NestJS si séparation souhaitée) + TypeScript
- Base de données : PostgreSQL 16
- ORM : Prisma
- Auth : NextAuth.js (credentials + JWT, RBAC)
- PWA : next-pwa (manifest + service worker, installable sur tablette atelier)
- Stockage fichiers : S3-compatible (Scaleway Object Storage ou MinIO en local)
- Emails : Brevo (API REST)
- SMS : SMS Partner (API REST)
- Décodage VIN : VinDecoderVehicle (API REST)
- Facturation électronique : Plateforme Agréée externe (API REST) — abstraction à prévoir, l'implémentation concrète sera branchée plus tard
- Hébergement cible : Scaleway ou OVHcloud (Docker + CI/CD GitHub Actions)
- Tests : Vitest (unitaire) + Playwright (E2E sur parcours critiques)

Si une dépendance est indisponible, proposer une alternative équivalente et attendre validation avant de changer de stack.

## 3. STRUCTURE DE PROJET ATTENDUE
crm-garage/ ├── prisma/ │ ├── schema.prisma │ └── seed.ts ├── src/ │ ├── app/ │ │ ├── (auth)/login/page.tsx │ │ ├── (dashboard)/ │ │ │ ├── layout.tsx │ │ │ ├── dashboard/page.tsx │ │ │ ├── clients/ │ │ │ ├── vehicules/ │ │ │ ├── devis/ │ │ │ ├── ordres-reparation/ │ │ │ ├── stock/ │ │ │ ├── bons-livraison/ │ │ │ ├── rendez-vous/ │ │ │ ├── factures/ │ │ │ ├── tarifs/ │ │ │ ├── collaborateurs/ │ │ │ └── analyse/ │ │ └── api/ │ │ ├── auth/[...nextauth]/route.ts │ │ ├── clients/ │ │ ├── vehicules/ │ │ ├── devis/ │ │ ├── ordres-reparation/ │ │ ├── stock/ │ │ ├── bons-livraison/ │ │ ├── rendez-vous/ │ │ ├── factures/ │ │ ├── tarifs/ │ │ ├── collaborateurs/ │ │ ├── analyse/ │ │ ├── integrations/ │ │ │ ├── vin/route.ts │ │ │ ├── email/route.ts │ │ │ ├── sms/route.ts │ │ │ └── facture-electronique/route.ts │ │ └── cron/ │ ├── components/ │ │ ├── ui/ │ │ ├── forms/ │ │ ├── tables/ │ │ └── layout/ │ ├── lib/ │ │ ├── db.ts │ │ ├── auth.ts │ │ ├── permissions.ts │ │ ├── pdf/ │ │ ├── validators/ │ │ ├── integrations/ │ │ │ ├── vin.ts │ │ │ ├── brevo.ts │ │ │ ├── sms-partner.ts │ │ │ └── facture-electronique.ts │ │ └── utils.ts │ ├── types/ │ └── styles/ ├── public/ │ ├── manifest.json │ └── icons/ ├── tests/ │ ├── unit/ │ └── e2e/ ├── .env.example ├── docker-compose.yml ├── Dockerfile ├── README.md └── SPECIFICATION_CRM.md
text
## 4. MODÈLE DE DONNÉES (référence)

Entités obligatoires (l'agent doit créer prisma/schema.prisma en respectant les relations et contraintes) :

- User (email, passwordHash, firstName, lastName, role: ADMIN | SECRETARIAT | MECANICIEN, isActive)
- Client (type: PARTICULIER | PRO, firstName, lastName, companyName, siret, tvaNumber, email, phone, address, paymentTerms, creditLimit, discountRate, marketingOptIn)
- Vehicule (clientId, vin, immatriculation unique, marque, modele, annee, motorisation)
- Piece (reference unique, nom, marque, fournisseur, categorie, prixAchatHT, prixVenteHT, stock, seuilAlerte, taillePneu, referencesCroisees[])
- Devis (numero unique, type: MECANIQUE | PIECE, clientId, vehiculeId?, userId, statut: BROUILLON | ENVOYE | VALIDE | REJETE, dateCreation, dateValidite, totalHT, totalTVA, totalTTC, motifRejet?)
- LigneDevis (devisId, type: MAIN_OEUVRE | FORFAIT | PIECE | FRAIS_DIVERS, designation, quantite, prixUnitaireHT, tvaRate, totalHT, pieceId?)
- OrdreReparation (numero unique, devisId unique, userId, statut: EN_ATTENTE_SIGNATURE | SIGNE | EN_COURS | TERMINE | FACTURE, signatureUrl?, signeLe?)
- Pointage (ordreId, userId, debut, fin?)
- BonCommande (numero unique, fournisseur, statut: EN_ATTENTE | RECEPTIONNEE_PARTIELLE | RECEPTIONNEE)
- BonLivraison (numero unique, bonCommandeId?, clientId?, dateLivraison)
- LigneBonLivraison (bonCommandeId?, bonLivraisonId?, pieceId, quantite)
- Facture (numero unique, devisId unique, clientId, statut: EMISE | PARTIELLEMENT_PAYEE | PAYEE | IMPAYEE | ANNULEE, dateEmission, dateEcheance, totalHT, totalTVA, totalTTC, montantPaye, facturXUrl?, statutPA?)
- Paiement (factureId, montant, mode: CB | ESPECES | CHEQUE | VIREMENT | PLUSIEURS_FOIS, datePaiement, reference?)
- RendezVous (clientId, vehiculeId, userId, debut, fin, motif?, statut: PLANIFIE | CONFIRME | HONORE | ANNULE | NO_SHOW)
- Tarif (type: MO1 | MO2 | MO3 | FORFAIT | FRAIS_DIVERS, libelle, montantHT, actif)
- MessageLog (clientId, canal: EMAIL | SMS, template, statut, contenu?, envoyeLe)
- Campagne (nom, type: MANUELLE | AUTOMATIQUE, template, actif, declencheur?)
- ParametreGarage (nomGarage, adresse, telephone, email, siret, tvaNumber, horaires Json, prefixes numérotation)

## 5. RÈGLES MÉTIER CONTRACTUELLES

### 5.1 Auth & rôles
- Toute route /dashboard/* et /api/* (hors auth) exige une session valide.
- ADMIN : accès total.
- SECRETARIAT : pas d'accès aux marges (prixAchatHT, marge), pas d'accès à la gestion des utilisateurs.
- MECANICIEN : accès uniquement à ses OR assignés, au pointage et aux photos. Pas d'accès aux prix, marges, factures.
- Middleware permissions.ts : fonction can(user, action, resource) à utiliser côté API ET côté UI.

### 5.2 Devis
- Numérotation : {PREFIXE}-{ANNEE}-{COMPTEUR_4} (ex : DEV-2026-0001), incrément en transaction.
- Calculs : totalHT = Σ(quantite × prixUnitaireHT) ; totalTVA = Σ(ligneHT × tvaRate / 100) ; totalTTC = totalHT + totalTVA. Arrondi 2 décimales.
- Workflow : BROUILLON → ENVOYE → VALIDE | REJETE. Retour arrière interdit sauf Admin (REOUVRIR).
- Validation d'un devis MECANIQUE (transaction atomique) :
  1. Vérifier stock suffisant pour chaque pièce. Si insuffisant → rollback + erreur 409 avec détail.
  2. Décrémenter le stock.
  3. Créer l'OrdreReparation lié.
  4. Passer le devis en VALIDE.
- Rejet : motifRejet obligatoire.
- Remise PRO : si client PRO et discountRate > 0, appliquer sur prixUnitaireHT des lignes PIECE uniquement. Tracer sur la facture.

### 5.3 Stock
- Alerte visuelle si stock <= seuilAlerte.
- Pas de commande fournisseur automatique.
- Une pièce ne peut être ajoutée à un devis si quantite > stock.
- Décrémentation uniquement à la validation du devis.

### 5.4 OR & pointage
- OR créé automatiquement à la validation du devis, statut EN_ATTENTE_SIGNATURE.
- Signature : upload image (canvas ou scan) dans S3, URL dans signatureUrl. Statut → SIGNE.
- Pointage : démarrer/arrêter sur un OR. Calcul du temps total.

### 5.5 Facturation
- Numérotation FAC-{ANNEE}-{COMPTEUR_4}.
- Transformation devis validé → facture : recopier lignes, calculer totaux, fixer dateEcheance selon paymentTerms (défaut 30 jours).
- Statut facture calculé :
  - montantPaye == 0 → EMISE
  - 0 < montantPaye < totalTTC → PARTIELLEMENT_PAYEE
  - montantPaye >= totalTTC → PAYEE
  - dateEcheance < now && montantPaye < totalTTC → IMPAYEE
- Rapport impayés : cron lundi matin → email récap à Admin + Secrétariat.

### 5.6 Rendez-vous
- Conflit interdit : impossible de créer un RDV si le même userId a un RDV qui chevauche [debut, fin].
- Codes couleur par collaborateur : attribution déterministe (hash userId sur palette 8 couleurs).
- Rappels : SMS/email J-1 et J-7 (paramétrable via Campagne), déclenchés par cron.

### 5.7 Communication
- Email via Brevo API, tracé dans MessageLog.
- SMS via SMS Partner API, tracé dans MessageLog.
- Marketing : opt-in RGPD obligatoire (marketingOptIn = true) avant tout envoi de campagne.
- Envois idempotents (pas de double envoi si cron tourne deux fois).

### 5.8 Intégrations externes
- VinDecoderVehicle : GET /api/integrations/vin?vin=XXX → { marque, modele, annee, motorisation } ou null. Timeout 3s. En cas d'échec, UI bascule en saisie manuelle.
- Brevo, SMS Partner, Plateforme Agréée : encapsulés dans lib/integrations/*.ts. Clés lues depuis process.env. Aucune clé en dur.
- Plateforme Agréée : interface FactureElectroniqueProvider avec envoyer(facture) et recupererStatut(factureId). Implémentation mock par défaut en dev.

### 5.9 RGPD
- Consentement marketing obligatoire (marketingOptIn).
- Droit à l'oubli : DELETE /api/clients/:id/anonymiser → remplace données perso par valeurs anonymes, conserve les factures (obligation 10 ans).
- Conservation : factures 10 ans, messages 3 ans, clients inactifs 5 ans (configurable).

## 6. EXIGENCES UI/UX

- shadcn/ui + Tailwind. Thème clair par défaut, pas de dark mode phase 1.
- 100 % français. Aucun texte en anglais dans l'interface.
- Responsive : priorité tablette atelier (768–1024 px) et desktop (≥ 1280 px). Mobile (< 768 px) : consultation uniquement.
- PWA : installable, manifest complet (icônes 192/512, nom, thème), service worker cache assets statiques (pas de mode offline complet phase 1).
- Accessibilité : contraste WCAG AA, focus visible, labels ARIA sur formulaires.
- Feedback : toasts (succès/erreur), loaders sur appels API, confirmations avant suppression.
- Formulaires : react-hook-form + zod côté client, validation zod côté API (schémas partagés dans lib/validators/).

Écrans prioritaires MVP :
1. Login
2. Dashboard (KPI cards + alertes)
3. Liste + fiche client
4. Création devis mécanique
5. OR vue mécanicien tablette
6. Stock liste + fiche pièce
7. Planning RDV
8. Facture (création depuis devis + suivi paiement)
9. Tableau de bord analytique

## 7. SÉCURITÉ

- HTTPS obligatoire en production.
- Mots de passe bcrypt cost 12.
- JWT en cookie httpOnly + SameSite=Lax.
- Rate limiting sur /api/auth/* (5 tentatives / 15 min / IP).
- Validation zod sur toutes les entrées (body, query, params).
- Aucune donnée sensible dans les logs.
- CORS restreint au domaine de production.
- En-têtes de sécurité (HSTS, CSP basique, X-Frame-Options).

## 8. TESTS

- Unitaires (Vitest) : calculs devis, décrémentation stock (avec rollback), calcul statut facture, permissions RBAC.
- E2E (Playwright) :
  1. Login → création client → création véhicule → création devis → validation → vérification OR + stock décrémenté.
  2. Création facture depuis devis → paiement → statut PAYEE.
  3. Création RDV → tentative conflit → refus.
  4. Mécanicien → accès refusé aux marges.
- Couverture minimale : 70 % sur lib/ et app/api/.

## 9. VARIABLES D'ENVIRONNEMENT (.env.example)


DATABASE_URL="postgresql://user:pass@localhost:5432/crm_garage" NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32" NEXTAUTH_URL="http://localhost:3000" S3_ENDPOINT="" S3_REGION="" S3_BUCKET="" S3_ACCESS_KEY="" S3_SECRET_KEY="" VIN_DECODER_API_KEY="" BREVO_API_KEY="" SMS_PARTNER_API_KEY="" SMS_PARTNER_SENDER="GARAGE" FACTURE_ELECTRONIQUE_PROVIDER="mock" FACTURE_ELECTRONIQUE_API_KEY="" APP_URL="http://localhost:3000" CRON_SECRET="generate-a-random-string"
text
## 10. ORDRE D'IMPLÉMENTATION (lots)

L'agent doit suivre cet ordre et s'arrêter après chaque lot pour validation utilisateur.

Lot 1 — Fondations
1. Init Next.js + TypeScript + Tailwind + shadcn
2. Setup Prisma + PostgreSQL (docker-compose)
3. Schéma Prisma complet + migration + seed (1 admin, 1 secrétariat, 1 mécanicien, tarifs par défaut, paramètres garage)
4. NextAuth + RBAC + middleware permissions
5. Layout dashboard + sidebar + page login

Lot 2 — Clients & Véhicules
6. CRUD clients (particuliers + PRO) + recherche
7. CRUD véhicules + intégration VinDecoderVehicle (avec fallback manuel)
8. Tests unitaires permissions

Lot 3 — Stock & Tarifs
9. CRUD pièces + alerte seuil + références croisées
10. CRUD tarifs (MO1/MO2/MO3, forfaits, frais divers)
11. Tests unitaires décrémentation stock

Lot 4 — Devis & OR
12. Création devis mécanique (formulaire complet, calculs temps réel)
13. Workflow devis (envoi, validation transactionnelle, rejet)
14. Génération PDF devis
15. OR auto + signature + vue mécanicien
16. Pointage

Lot 5 — Facturation
17. Transformation devis → facture + numérotation
18. Enregistrement paiements + statut auto
19. Génération PDF facture
20. Rapport impayés (endpoint cron)

Lot 6 — RDV & Communication
21. Planning RDV + détection conflits + codes couleur
22. Intégration Brevo (email) + SMS Partner (SMS)
23. Rappels RDV (cron)
24. SMS « commande prête » sur BL

Lot 7 — BL & Analyse
25. Bons de commande + BL + regroupement
26. Tableau de bord analytique (CA, marges, top pièces, CA par collaborateur)
27. Export CSV

Lot 8 — Conformité & finitions
28. Interface Plateforme Agréée (mock + implémentation à brancher)
29. RGPD (anonymisation, consentement)
30. PWA (manifest, service worker, icônes)
31. Tests E2E Playwright
32. README + documentation technique + guide utilisateur

## 11. CRITÈRES D'ACCEPTATION GLOBAUX

- Tous les lots 1 à 8 implémentés et validés.
- Un devis mécanique validé génère un OR ET décrémente le stock en une seule transaction (rollback si stock insuffisant).
- Une pièce sous seuil affiche une alerte visuelle sur la liste stock et le dashboard.
- Une facture émise est transmise à la Plateforme Agréée (ou mock) et son statut est tracé.
- Un SMS de rappel RDV et un SMS « commande prête » sont envoyés et tracés dans MessageLog.
- Le tableau de bord affiche CA, marge, CA par collaborateur, top pièces.
- Un Mécanicien ne peut jamais accéder aux marges ni aux prix d'achat (vérifié par test E2E).
- L'application est installable en PWA sur tablette.
- Tests unitaires et E2E passent en CI.
- Documentation technique et guide utilisateur fournis.
- Aucune clé API en dur dans le code.

## 12. CE QUE L'AGENT NE DOIT PAS FAIRE

- Ne pas ajouter de fonctionnalités hors périmètre (TPE intégré, app native, scan code-barres, catalogue fournisseur, commande auto).
- Ne pas changer de stack sans validation.
- Ne pas implémenter d'intégration réelle à la Plateforme Agréée sans identifiants (utiliser le mock).
- Ne pas exposer les marges aux rôles non autorisés, même dans les réponses API.
- Ne pas stocker de secrets en clair dans le code ou les commits.
- Ne pas passer au lot suivant sans validation de l'utilisateur.

## 13. PREMIÈRE ACTION ATTENDUE DE L'AGENT

1. Lire ce document en entier.
2. Poser toutes les questions de clarification nécessaires (une seule fois, groupées).
3. Proposer un plan d'action pour le Lot 1 uniquement.
4. Attendre validation avant d'écrire la moindre ligne de code.

Fin de la spécification. Version 1.0 — Octobre 2026.