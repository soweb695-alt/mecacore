# Mettre MecaCore en ligne (Neon + GitHub + Vercel)

Guide pas à pas. Les commandes se tapent dans le **Terminal**, dans le dossier du projet :

```bash
cd ~/Desktop/crm-garage
```

> Ne collez jamais une URL de base de données, un mot de passe ou un secret dans un message, un ticket ou un fichier versionné. Ils vont dans `.env` (local, ignoré par Git) ou dans les réglages Vercel.

---

## 1. Base de données Neon

### Poolée ou directe ?

Neon donne deux adresses pour la même base :

| | Hôte | Sert à | Variable |
| --- | --- | --- | --- |
| **Poolée** | contient `-pooler` | l'application en ligne : beaucoup de connexions courtes (chaque requête Vercel ouvre la sienne). Le *pooler* (PgBouncer) les mutualise pour ne pas saturer la base. | `DATABASE_URL` |
| **Directe** | sans `-pooler` | les **migrations** et le **seed** : Prisma a besoin d'une vraie connexion longue (verrous, transactions de schéma) que le pooler ne garantit pas. | `DIRECT_URL` |

Il faut **les deux**. L'adresse directe s'obtient en retirant `-pooler` de l'hôte (ou dans Neon : **Connect** → décocher **Connection pooling**).

### Dans `.env` (poste local)

Elles sont rangées sous `NEON_DATABASE_URL` et `NEON_DIRECT_URL`, **pas** sous `DATABASE_URL` : ainsi `npm run dev` et les tests restent sur la base locale et ne touchent jamais la production.

### Créer les tables et les comptes

```bash
npm run prod:migrate
```

applique les migrations sur Neon (rejouable : « No pending migrations » si tout est à jour).

```bash
PROD_ADMIN_EMAIL="vous@votregarage.fr" PROD_SECRETARIAT_EMAIL="magasin@votregarage.fr" PROD_MECANICIEN_EMAIL="atelier@votregarage.fr" npm run prod:seed
```

crée les trois comptes avec des **mots de passe neufs affichés une seule fois** dans le terminal : notez-les tout de suite (gestionnaire de mots de passe). Crée aussi les tarifs par défaut et des coordonnées de garage provisoires, à corriger ensuite dans **Mon Garage**. Rejouable sans rien écraser.

Vérification : sur <https://console.neon.tech> → votre projet → **Tables** : `User` contient 3 lignes.

---

## 2. Code sur GitHub (dépôt privé)

### 2.1 Créer le dépôt vide

1. <https://github.com> → bouton **+** en haut à droite → **New repository**.
2. **Repository name** : `mecacore`. Cocher **Private**.
3. Ne cocher **aucune** case (pas de README, pas de .gitignore, pas de licence).
4. **Create repository**. Gardez la page ouverte : elle affiche l'adresse `https://github.com/<votre-compte>/mecacore.git`.

### 2.2 Créer un jeton d'accès (GitHub refuse le mot de passe dans le terminal)

1. GitHub → photo de profil → **Settings** → tout en bas à gauche **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name** : `mecacore-mac`. **Expiration** : 90 jours.
3. **Repository access** : **Only select repositories** → `mecacore`.
4. **Permissions** → **Repository permissions** → **Contents** : **Read and write**.
5. **Generate token** et copiez-le (il ne sera plus affiché).

### 2.3 Envoyer le code

```bash
git init
```

```bash
git add .
```

Vérifiez qu'aucun secret ne part : la commande suivante ne doit **rien** afficher.

```bash
git status --short | grep -E "\.env$|\.pgdata|\.storage"
```

```bash
git commit -m "MecaCore : première version"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/<votre-compte>/mecacore.git
```

```bash
git push -u origin main
```

Au `push`, le terminal demande **Username** (votre identifiant GitHub) puis **Password** : collez le **jeton** (rien ne s'affiche quand vous collez, c'est normal), puis Entrée. Le Mac le mémorise dans le trousseau.

---

## 3. Vercel

### 3.1 Générer les secrets de production (différents de ceux du poste local)

```bash
openssl rand -base64 32
```

→ valeur de `NEXTAUTH_SECRET`.

```bash
openssl rand -hex 24
```

→ valeur de `CRON_SECRET`.

### 3.2 Importer le dépôt

1. <https://vercel.com/new> → **Continue with GitHub** si demandé → **Install** l'application Vercel sur votre compte GitHub, en autorisant au moins le dépôt `mecacore`.
2. Dans **Import Git Repository**, à côté de `mecacore` : **Import**.
3. **Project Name** : `mecacore` (l'adresse sera `https://mecacore.vercel.app` si elle est libre, sinon Vercel ajoute un suffixe : notez l'adresse finale).
4. **Framework Preset** : Next.js (détecté tout seul). **Root Directory** : `./`.
5. Déplier **Build and Output Settings** → **Build Command** → activer **Override** → saisir `npm run vercel-build`. Laisser le reste par défaut.
6. Déplier **Environment Variables** et ajouter **une par une** les variables du tableau ci-dessous (**Key** = nom, **Value** = valeur, **Add**).
7. **Deploy**. Comptez 2 à 4 minutes.

### 3.3 Variables d'environnement

Plus tard, elles se modifient dans : projet Vercel → **Settings** → **Environment Variables**. Après toute modification : **Deployments** → menu **⋯** du dernier déploiement → **Redeploy**.

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | l'URL Neon **poolée** (valeur de `NEON_DATABASE_URL` dans `.env`) |
| `DIRECT_URL` | l'URL Neon **directe** (valeur de `NEON_DIRECT_URL` dans `.env`) |
| `NEXTAUTH_SECRET` | généré en 3.1 |
| `NEXTAUTH_URL` | `https://mecacore.vercel.app` (votre adresse exacte, sans `/` final) |
| `APP_URL` | la même adresse |
| `CRON_SECRET` | généré en 3.1 |
| `TRUSTED_PROXY_HOPS` | `1` |
| `NEXT_PUBLIC_APP_NAME` | `MecaCore` |
| `FACTURE_ELECTRONIQUE_PROVIDER` | `mock` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | stockage des fichiers, voir 3.5 |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | facultatif : envoi réel des e-mails (sinon simulés et tracés) |
| `SMS_PARTNER_API_KEY`, `SMS_PARTNER_SENDER` | facultatif : envoi réel des SMS |

**Ne pas** ajouter les variables `SEED_*`, `NEON_*` ni `DATABASE_URL` de la base locale.

Si l'adresse finale diffère de celle saisie dans `NEXTAUTH_URL` / `APP_URL` : corrigez les deux puis **Redeploy**, sinon la connexion échoue.

### 3.4 Région des fonctions

Projet → **Settings** → **Functions** → **Function Region** : choisissez la région la plus proche de la base Neon (même région AWS), puis **Save** et **Redeploy**. Une base et des fonctions éloignées ajoutent de la latence à chaque requête.

### 3.5 Stockage des fichiers (photos, signatures, logo)

Sur Vercel, le disque est en lecture seule : **sans S3, l'ajout d'une photo, d'une signature ou du logo échoue.** Le reste de l'application fonctionne. Créez un bucket compatible S3 (Cloudflare R2, Scaleway Object Storage, AWS S3…), privé, puis renseignez les cinq variables `S3_*` et redéployez.

### 3.6 Tâches planifiées

Le fichier `.github/workflows/cron.yml` appelle les tâches (relances, rappels, purge RGPD). Sur GitHub → dépôt `mecacore` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :

- `APP_URL` = votre adresse Vercel
- `CRON_SECRET` = la même valeur que dans Vercel

Test : onglet **Actions** → **Tâches planifiées** → **Run workflow**.

---

## 4. Migrations au fil du temps

- Le script `vercel-build` lance `prisma migrate deploy` **uniquement** pour le déploiement de **production** (`VERCEL_ENV=production`), puis `next build`. Les déploiements de prévisualisation (branches) ne touchent jamais la base.
- Chaque `git push` sur `main` redéploie et applique les nouvelles migrations automatiquement.
- Une migration qui échoue fait échouer le déploiement : l'ancienne version reste en ligne. Le détail est dans **Deployments** → le déploiement → **Build Logs**.
- Contrôle à tout moment depuis le poste local :

```bash
npm run prod:migrate
```

« No pending migrations to apply » = la base est à jour.

---

## 5. Vérification finale

1. Vercel → **Deployments** : le dernier déploiement est **Ready** (pastille verte). Cliquez **Visit**.
2. La page **Connexion · MecaCore** s'affiche avec le logo.
3. Connectez-vous avec le compte administrateur créé par `prod:seed`.
4. **Mon Garage** : saisissez les vraies coordonnées → **Enregistrer** → « Informations du garage enregistrées » (écriture en base OK).
5. **Clients** → **Nouveau client** → « Client Test » → **Créer le client**.
6. Neon → **Tables** → `Client` : la ligne « Client Test » est là. La base est bien connectée.
7. **Collaborateurs** : remplacez les e-mails provisoires si besoin et changez les mots de passe.
8. En cas d'erreur : Vercel → projet → **Logs** (erreurs en rouge, avec l'heure et la route).

Supprimez ensuite le client de test (**Clients** → fiche → **Anonymiser ce client**).

---

## Sécurité

- Si une URL de base ou un secret a été partagé (message, capture), **changez-le** : Neon → **Roles** → `neondb_owner` → **Reset password**, puis mettez à jour `NEON_*` dans `.env` et `DATABASE_URL` / `DIRECT_URL` dans Vercel, et **Redeploy**.
- Activez la double authentification sur GitHub, Vercel et Neon.
