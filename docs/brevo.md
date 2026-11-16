# Connecter Brevo (envoi des e-mails)

MecaCore envoie par Brevo tous ses e-mails : devis (PDF joint), bons de livraison, « Véhicule prêt », rappels de rendez-vous, récapitulatif des impayés et campagnes. Sans configuration, rien n'est envoyé : chaque tentative est notée « non envoyé : service non configuré » dans l'historique du client.

Deux variables d'environnement suffisent :

| Variable | Valeur |
| --- | --- |
| `BREVO_API_KEY` | Clé API Brevo (commence par `xkeysib-`) |
| `BREVO_SENDER_EMAIL` | Adresse d'expédition, **vérifiée dans Brevo** (ex. `atelier@mon-garage.fr`) |

Le nom affiché de l'expéditeur est le **nom du garage** et les réponses des clients arrivent sur l'**e-mail du garage** : les deux se règlent dans **Mon Garage › Coordonnées**.

## 1. Créer le compte et vérifier l'expéditeur

1. Créez un compte sur brevo.com (l'offre gratuite permet 300 e-mails par jour).
2. Menu **Expéditeurs, domaines et IP dédiées** (Senders, Domains & Dedicated IPs) › **Expéditeurs** › **Ajouter un expéditeur** : saisissez l'adresse qui servira de `BREVO_SENDER_EMAIL`, puis cliquez sur le lien de confirmation reçu.
3. Recommandé : onglet **Domaines** › **Authentifier** votre domaine (enregistrements DKIM, SPF et DMARC à ajouter chez votre registrar). Sans authentification, les e-mails partent mais risquent davantage les indésirables. Une adresse Gmail ou Outlook comme expéditeur est déconseillée pour la même raison.

## 2. Créer la clé API

1. Menu de votre profil › **SMTP et API** › onglet **Clés API** › **Générer une nouvelle clé API**. Nommez-la « MecaCore ».
2. Copiez la clé immédiatement : Brevo ne la réaffiche pas.
3. Ne l'envoyez jamais par e-mail ou messagerie, ne la mettez pas dans le code : elle va uniquement dans les variables d'environnement de l'hébergeur.

**Adresses IP autorisées** : Brevo peut bloquer les appels API venant d'adresses IP inconnues. Sur Vercel, les adresses changent à chaque requête. Si la vérification affiche une erreur 401 mentionnant une adresse IP non reconnue, désactivez ce blocage dans **Sécurité › IP autorisées** de votre compte Brevo.

## 3. Renseigner l'hébergeur

Sur Vercel : projet › **Settings** › **Environment Variables**, ajoutez `BREVO_API_KEY` et `BREVO_SENDER_EMAIL` pour l'environnement **Production** (et Preview si vous testez sur une préversion), puis **redéployez** (les variables ne sont lues qu'au déploiement).

En local, mettez-les dans `.env` puis relancez `npm run dev`.

## 4. Vérifier depuis MecaCore

Connecté en administrateur, **Mon Garage › Envoi des e-mails (Brevo)** :

1. **Vérifier la connexion** : appelle Brevo sans rien envoyer. « Clé acceptée par Brevo (compte …) » confirme la clé.
2. **Envoyer le test** : envoie un vrai e-mail à l'adresse indiquée (par défaut celle du garage). Vérifiez la réception, l'expéditeur affiché, puis **répondez** pour contrôler que la réponse arrive bien sur l'e-mail du garage.

## Erreurs fréquentes

| Message | Cause | Solution |
| --- | --- | --- |
| Non configuré : BREVO_API_KEY … manque | Variable absente ou déploiement non relancé | Ajouter la variable puis redéployer |
| Réponse 401 (clé API invalide) : Key not found | Clé mal copiée, supprimée, ou clé SMTP au lieu d'une clé API | Générer une nouvelle clé API (onglet **Clés API**, pas **SMTP**) |
| Réponse 401 … unrecognised IP address | Blocage par adresse IP | Désactiver le blocage (étape 2) |
| Réponse 400 (requête refusée) : sender … not valid | `BREVO_SENDER_EMAIL` non vérifiée dans Brevo | Ajouter et confirmer l'expéditeur (étape 1) |
| Réponse 429 | Quota quotidien atteint | Attendre le lendemain ou changer d'offre |

Le message exact de Brevo apparaît aussi dans l'historique de la fiche client pour chaque envoi en échec.
