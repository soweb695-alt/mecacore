# Guide technique

## Architecture

```
src/
  app/
    (auth)/login             page de connexion
    (dashboard)/…            pages protégées (layout avec sidebar et vérification de session)
    api/…                    routes API (une enveloppe commune : lib/api.ts)
    manifest.ts              manifeste PWA
  components/                ui/ (shadcn), layout/, forms/, + composants par domaine
  lib/
    auth.ts, session.ts      NextAuth, utilisateur courant relu en base à chaque requête
    permissions.ts           RBAC : can(user, action, ressource), canSeeMargins
    api.ts                   route() : session, permission, validation zod, erreurs, contrôle d'origine
    services/                logique métier (devis, factures, stock, rdv, bl, analyse, messages, rappels, retention)
    validators/              schémas zod partagés client / serveur
    integrations/            vin, brevo, sms-partner, facture-electronique (abstraction + mock)
    pdf/, money.ts, time.ts, numbering.ts, storage.ts, csv.ts, colors.ts
  proxy.ts                   garde d'authentification + en-tête CSP (équivalent du middleware, Next.js 16)
prisma/                      schema.prisma, migrations, seed.ts, seed-demo.ts
tests/                       unit/, integration/ (vraie base PostgreSQL), e2e/ (Playwright)
```

Le front lit les données directement côté serveur (composants serveur) et écrit via les routes API (`fetch` depuis des formulaires `react-hook-form` + `zod`).

## Rôles et droits

Matrice unique dans `src/lib/permissions.ts`, utilisée par l'API, les pages serveur et la navigation.

| | Admin | Magasin (SECRETARIAT) | Atelier (MECANICIEN) |
| --- | --- | --- | --- |
| Clients, véhicules, devis, factures, paiements, RDV, commandes/livraisons | oui | oui (pas de suppression, pas d'anonymisation) | non |
| Pièces | oui | lecture / création / modification ; **prix d'achat visible et modifiable, jamais la marge** | non |
| Tarifs | écriture | lecture | non |
| Campagnes | oui | oui | non |
| Analyse, export CSV d'analyse, collaborateurs | oui | non | non |
| Ordres de réparation | tous | tous | uniquement les siens (pointage, tâches, photos, signature) |

Le prix d'achat est réservé à l'admin et au Magasin (`canSeePurchasePrice`), la marge à l'admin seul (`canSeeMargins`) ; ces données ne sortent jamais du serveur pour un rôle non autorisé : `pieceVue`, `lireDevis` et les pages construisent des objets sans ces champs (testé en intégration et en E2E).

## Règles métier clés

- **Numérotation** `{PREFIXE}-{ANNEE}-{0001}` : table `Compteur`, incrément atomique dans la transaction (`lib/numbering.ts`).
- **Calculs** en centimes entiers (`lib/money.ts`), recalculés côté serveur ; les totaux envoyés par le navigateur sont ignorés.
- **Validation d'un devis mécanique** (`services/devis.ts`) : une seule transaction — contrôle du stock (409 + détail par pièce), décrémentation atomique conditionnelle (`UPDATE … WHERE stock >= n`), création de l'OR et de ses tâches, passage en VALIDE. Un échec annule tout. Deux validations simultanées : une seule aboutit.
- **Devis** : créé « Brouillon » ; il devient « Envoyé » uniquement quand l'envoi par e-mail (Brevo, PDF en pièce jointe) a réussi — simulation ou échec : il reste « Brouillon ». Validation et rejet possibles depuis Brouillon ou Envoyé ; modifiable jusqu'à validation/rejet. Mécanique : validation avec technicien et créneau obligatoires → rendez-vous + OR dans la même transaction. Pièces : bon de livraison « en attente » créé automatiquement, véhicule facultatif.
- **Véhicule d'abord** : `Vehicule.clientId` est facultatif et modifiable ; kilométrage et prochain CT sur le véhicule (le kilométrage est aussi gardé sur chaque devis).
- **Réapprovisionnement automatique** (`services/reappro.ts`) : une pièce au seuil d'alerte génère un bon de commande « en attente » (quantité 2 × seuil, regroupé par fournisseur, jamais deux fois pour la même pièce).
- **Thème par rôle** : le layout racine lit la session et pose `data-role` sur `<html>` ; les couleurs sont des variables CSS (`globals.css`). Magasin : thème par défaut (barre blanche, boutons bleus) ; Atelier : gris anthracite #374151 ; Admin : bleu #1D5FD1.
- **Couleur des collaborateurs** : `User.couleur` (#RRGGBB, facultative). `couleurCollaborateur(id, couleur)` renvoie la couleur choisie ou, à défaut, une couleur automatique déterministe ; utilisée par le planning, le formulaire de rendez-vous et l'analyse.
- **BL livré** : `marquerLivre` passe le bon à « Livré » puis envoie le PDF (sans prix) par e-mail ; l'envoi est tracé dans `MessageLog` (template `bon_livraison`) et son échec n'annule jamais la livraison.
- **Remise PRO** : appliquée par l'interface sur le prix unitaire des seules lignes « Pièce » ; le taux est tracé sur le devis puis la facture.
- **Facture** : recopie des lignes (avec le prix d'achat de chaque pièce pour la marge), échéance = délai de paiement du client (30 jours par défaut), transmission à la Plateforme Agréée (mock par défaut), statut recalculé à chaque paiement et par les tâches planifiées (`lib/facture-statut.ts`).
- **Paiements** : verrou de ligne (`FOR UPDATE`) pour empêcher deux règlements concurrents du solde.
- **Rendez-vous** : un collaborateur ne peut pas avoir deux rendez-vous qui se chevauchent ; contrôle sous verrou consultatif PostgreSQL. Heures saisies et affichées en Europe/Paris, stockées en UTC.
- **Messages** : tout envoi passe par `services/messages.ts` — clé d'idempotence (pas de double envoi si un cron tourne deux fois), trace dans `MessageLog`, consentement marketing vérifié pour les messages marketing.
- **Bons de livraison** : En attente → Prêt à être retiré → Livré. Facturation groupée (`creerFactureDepuisBons`) : bons « Livré » d'un même client, prix des devis (prix de vente actuel pour un bon créé à la main) ; un bon n'est facturé qu'une fois ; `Facture.devisId` est facultatif.
- **Import / export de pièces** (`lib/import-pieces.ts`, `services/import-pieces.ts`, `lib/export-pieces.ts`) : CSV (UTF-8 ou Windows-1252, séparateur détecté) et .xlsx (exceljs, signature ZIP vérifiée, formules lues par leur résultat) ; 2 Mo et 2 000 lignes maximum ; aperçu sans écriture puis import des lignes valides dans une transaction ; référence existante = mise à jour, stock AJOUTÉ ; prix d'achat ignoré si le rôle ne le voit pas ; bon de commande automatique déclenché si une pièce arrive au seuil. Export : CSV avec BOM et neutralisation des formules.
- **Remise PRO** : appliquée par l'interface sur les pièces du stock (recalcul au changement de client, prix modifiable) ; `prixCatalogueHT` n'est conservé que sur les lignes « Pièce » réellement remisées (devis → facture) pour tracer taux et montant de la remise. Jamais sur main d'œuvre, forfaits ou frais.
- **Campagnes** (`services/campagnes.ts`) : e-mails via Brevo uniquement, destinataires = clients actifs, non anonymisés, avec e-mail et `marketingOptIn` (re-vérifié à l'envoi) ; 500 destinataires maximum ; clé d'idempotence `campagne:ID:CLIENT` ; contenu échappé ; lien de désinscription signé (HMAC-SHA256 de l'identifiant avec `NEXTAUTH_SECRET`, page publique `/desinscription` + `POST /api/public/desinscription`, en-tête `List-Unsubscribe`). Accès : Admin et Magasin.
- **Stock des commandes** : une réception de bon de commande ajoute au stock ; un bon de livraison est un document sans effet sur le stock. L'envoi de SMS « commande prête » est désactivé (les rappels de rendez-vous restent actifs).
- **Analyse** : CA par collaborateur attribué au mécanicien de l'OR, à défaut à l'auteur du devis ; marge = CA HT − coût d'achat des pièces vendues.

## Sécurité

- Mots de passe : bcrypt coût 12 ; comparaison à coût constant même pour un e-mail inconnu.
- Session : JWT en cookie httpOnly, SameSite=Lax, `Secure` en HTTPS, durée 8 h. L'utilisateur est relu en base à chaque requête : un compte désactivé ou un changement de rôle s'applique immédiatement.
- Limitation de tentatives : 5 échecs / 15 min / IP, stockée en base (valable sur plusieurs instances).
- Toutes les entrées (corps, requête, paramètres) sont validées par zod ; taille des corps limitée.
- Contrôle de l'en-tête `Origin` sur les requêtes qui modifient des données (protection CSRF en plus de SameSite).
- En-têtes : CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy ; `X-Powered-By` retiré.
- Fichiers (signatures, photos) : bucket privé, servis par une route authentifiée qui vérifie l'accès à l'OR et que le fichier est référencé en base ; type réel contrôlé par les octets magiques ; chemins validés (anti-traversée).
- Routes cron : `Authorization: Bearer CRON_SECRET`, comparaison à temps constant.
- E-mails HTML : toutes les valeurs insérées sont échappées. Export CSV : neutralisation des formules (`= + - @`).
- Journaux : jamais de données personnelles ni de secrets (seul le type d'erreur est journalisé).
- Redirection après connexion limitée aux chemins internes.
- Dépendances : `npm audit` sans vulnérabilité au moment de la livraison ; exécuté en CI.

## Intégrations

| Service | Fichier | État |
| --- | --- | --- |
| Décodage plaque | `lib/integrations/vin.ts` (`decoderPlaque`) | Interface prête (`PLAQUE_DECODER_API_URL` / `PLAQUE_DECODER_API_KEY`) ; aucun fournisseur branché : saisie manuelle. Même format de réponse que le VIN. |
| Entreprise (SIRET) | `lib/integrations/entreprise.ts` | API publique « Recherche d'entreprises » (data.gouv, sans clé) : raison sociale, SIRET, adresse, n° de TVA (déduit du SIREN si absent). |
| Décodage VIN | `lib/integrations/vin.ts` | À adapter au contrat exact de l'API VinDecoderVehicle (URL dans `VIN_DECODER_API_URL`, clé dans `VIN_DECODER_API_KEY`). Sans clé ou en cas de délai > 3 s : saisie manuelle. |
| E-mail | `brevo.ts` | API REST Brevo (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`). Sans clé : simulation tracée. |
| SMS | `sms-partner.ts` | API SMS Partner (`SMS_PARTNER_API_KEY`, `SMS_PARTNER_SENDER`). Sans clé : simulation tracée. |
| Facture électronique | `facture-electronique.ts` | Interface `FactureElectroniqueProvider` + mock. À brancher quand les identifiants de la PA seront disponibles. Le Factur-X (PDF/A-3 avec XML) n'est pas généré : la PA ou une bibliothèque dédiée s'en chargera. |
| Stockage | `storage.ts` | S3 compatible (`S3_*`). Sans configuration : dossier local `.storage/` (développement uniquement, à ne pas utiliser en production serverless). |

Les contrats des API tierces (VIN, Brevo, SMS Partner) n'ont pas pu être testés avec de vraies clés : à valider avec un envoi réel avant la mise en production.

## Tests

- `tests/unit` : permissions, calculs, statut de facture, fuseaux horaires, couleurs, CSV.
- `tests/integration` : services sur une vraie base (rollback de stock, concurrence, numérotation, facturation, rendez-vous, rappels idempotents, RGPD, marges masquées, limitation de connexion).
- `tests/e2e` : 4 parcours Playwright (devis → OR + stock, facture → paiement, conflit de rendez-vous, mécanicien sans accès aux marges).

## Pistes d'évolution

Avoir (note de crédit) pour corriger une facture, envoi des devis et factures par e-mail en pièce jointe, interface de gestion des campagnes marketing, historique des mouvements de stock, journal d'audit.
