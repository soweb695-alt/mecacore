# Créer la base Neon et la connecter

Neon héberge PostgreSQL. L'application utilise deux URL de connexion différentes.

| Variable | Usage | Forme |
| --- | --- | --- |
| `DATABASE_URL` | L'application (requêtes) | hôte **avec** `-pooler` |
| `DIRECT_URL` | Migrations Prisma et seed | hôte **sans** `-pooler` |

## 1. Créer le compte et le projet

1. Aller sur <https://neon.tech> et créer un compte (e-mail ou GitHub). Le plan gratuit suffit pour démarrer.
2. **New project** :
   - Nom : `crm-garage`
   - Version de Postgres : 16 ou plus récente
   - Région : **Europe (Frankfurt, `aws-eu-central-1`)** pour rester proche de vos utilisateurs et des données françaises
3. Neon crée automatiquement une base `neondb` et un rôle propriétaire.

## 2. Récupérer les deux URL

1. Sur le tableau de bord du projet, cliquer sur **Connect**.
2. Activer l'option **Connection pooling** : copier l'URL, c'est `DATABASE_URL` (l'hôte contient `-pooler`).
3. Désactiver l'option : copier l'URL, c'est `DIRECT_URL` (sans `-pooler`).
4. Les deux doivent se terminer par `?sslmode=require`.

## 3. Configurer l'application

Dans `.env` (local) ou dans les variables d'environnement de l'hébergeur (production) :

```bash
DATABASE_URL="postgresql://<utilisateur>:<mot_de_passe>@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://<utilisateur>:<mot_de_passe>@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

Ne jamais enregistrer ces valeurs dans Git (`.env` est ignoré) ni les coller dans un message ou un ticket.

## 4. Créer les tables et les comptes de départ

```bash
npm run db:deploy      # applique les migrations (utilise DIRECT_URL)
SEED_ADMIN_PASSWORD='un-mot-de-passe-de-12-caracteres-min' npm run db:seed
```

Le seed crée l'administrateur, le secrétariat, le mécanicien, les tarifs par défaut et les paramètres du garage. Il est rejouable sans écraser l'existant. Changez ensuite les identifiants et le nom du garage depuis l'application.

## 5. Vérifier

```bash
npm run build && npm start
```

Ouvrir l'application et se connecter avec le compte administrateur. Dans Neon, l'onglet **Tables** doit afficher les tables (`User`, `Client`, `Devis`…).

## Bonnes pratiques

- **Branches Neon** : créer une branche `staging` pour tester une migration sur une copie des données avant la production.
- **Sauvegardes** : activer la restauration à un instant donné (point-in-time restore) dans les réglages du projet ; sa durée dépend du plan.
- **Mise en veille** : sur le plan gratuit, la base se met en veille après quelques minutes d'inactivité ; la première requête suivante est un peu plus lente.
- **Rotation du mot de passe** : en cas de fuite, réinitialiser le mot de passe du rôle dans Neon (**Roles**) puis mettre à jour les deux URL.
- **Accès réseau** : sur les plans qui le proposent, restreindre les connexions à l'IP de l'hébergeur (**IP Allow**).
