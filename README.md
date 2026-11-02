# MecaCore

CRM web sur mesure pour un garage (mécanique et vente de pièces) : clients, véhicules, stock, devis, ordres de réparation sur tablette, facturation, planning, messages, analyse. Interface 100 % française, installable en PWA.

- **Front et API** : Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui
- **Base de données** : PostgreSQL, **Neon** en production (Prisma 7 + `@prisma/adapter-pg`)
- **Authentification** : NextAuth (identifiants + JWT en cookie httpOnly), rôles Admin / Secrétariat / Mécanicien
- **Tests** : Vitest (unitaires et intégration sur vraie base) + Playwright (E2E)

La spécification de référence est `SPECIFICATION_CRM.md`. Maquette : `maquette/index.html`.

## Démarrage local

Prérequis : Node 24 (ou 22 LTS) et npm.

```bash
npm install
cp .env.example .env        # puis renseigner NEXTAUTH_SECRET et CRON_SECRET (openssl rand -base64 32)
npm run db:dev              # PostgreSQL local embarqué (laisser ce terminal ouvert), port 54329
```

Dans `.env`, pour la base locale : `DATABASE_URL="postgresql://postgres:postgres@localhost:54329/crm_garage"`.
Si Docker est installé, `docker compose up -d postgres` fonctionne aussi (URL sur le port 5432).

```bash
npx prisma migrate deploy   # crée les tables
npm run db:seed             # comptes admin / secrétariat / mécanicien, tarifs, paramètres
npm run db:seed-demo        # (facultatif) clients, véhicules et pièces de démonstration
npm run dev                 # http://localhost:3000
```

Les mots de passe des comptes initiaux sont lus dans `SEED_ADMIN_PASSWORD`, `SEED_SECRETARIAT_PASSWORD`, `SEED_MECANICIEN_PASSWORD` (12 caractères minimum). Sans valeur, ils sont générés aléatoirement et affichés **une seule fois** dans le terminal.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement, build, production |
| `npm run typecheck` / `lint` | Contrôles statiques |
| `npm test` | Tests unitaires et d'intégration (base `crm_garage_test`) |
| `npm run test:e2e` | Parcours critiques Playwright |
| `npm run test:all` | Tout ce qui précède |
| `npm run db:migrate` | Nouvelle migration (développement) |
| `npm run db:deploy` | Applique les migrations (production) |

## Déploiement

1. Créer la base Neon et récupérer les deux URL : voir [`docs/neon.md`](docs/neon.md).
2. Renseigner les variables d'environnement (`.env.example` liste tout) sur l'hébergeur.
3. Appliquer les migrations : `npm run db:deploy` (avec `DIRECT_URL`), puis `npm run db:seed` une fois.
4. Construire et lancer : `npm run build && npm start`, ou l'image Docker (`Dockerfile`, sortie `standalone`).
5. HTTPS obligatoire en production (`NEXTAUTH_URL` en `https://`). Le cookie de session passe alors en `__Secure-` automatiquement.
6. Tâches planifiées : `.github/workflows/cron.yml` appelle `/api/cron/*` avec `CRON_SECRET` (secrets GitHub `APP_URL` et `CRON_SECRET`).

| Route cron | Fréquence | Rôle |
| --- | --- | --- |
| `/api/cron/impayes` | lundi matin | E-mail récapitulatif des factures impayées (admin + secrétariat) |
| `/api/cron/rappels-rdv` | quotidienne | Rappels de rendez-vous J-1 et J-7 (campagnes automatiques) |
| `/api/cron/retention` | mensuelle | Purge RGPD (messages > 3 ans, clients inactifs > 5 ans) |

## Documentation

- [`docs/guide-technique.md`](docs/guide-technique.md) : architecture, sécurité, règles métier, intégrations
- [`docs/guide-utilisateur.md`](docs/guide-utilisateur.md) : utilisation au quotidien par rôle
- [`docs/deploiement-vercel.md`](docs/deploiement-vercel.md) : mise en ligne pas à pas (Neon, GitHub, Vercel)
- [`docs/neon.md`](docs/neon.md) : créer le compte Neon et connecter la base
