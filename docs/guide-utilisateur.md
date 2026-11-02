# Guide utilisateur

## Se connecter

Ouvrez l'adresse de l'application, saisissez votre e-mail et votre mot de passe. Après 5 erreurs, la connexion est bloquée 15 minutes. En cas d'oubli, demandez à l'administrateur de réinitialiser votre mot de passe (Collaborateurs → Modifier).

Sur tablette : ouvrez l'application dans le navigateur puis « Ajouter à l'écran d'accueil » pour l'installer comme une application.

## Magasin et administrateur

### Clients et véhicules
**Clients → Nouveau client**. Un professionnel a une raison sociale, un SIRET, une remise sur les pièces et un délai de paiement.

**Véhicules** : un véhicule se crée avec sa plaque ou son VIN (boutons **Décoder la plaque** et **Décoder le VIN** pour retrouver marque, modèle et motorisation ; le décodage de plaque sera actif quand un fournisseur sera branché), son kilométrage et la date du prochain contrôle technique. Un client lui est associé (modifiable depuis la fiche du véhicule). Cliquez sur un véhicule pour voir l'**historique** de ses devis et factures.

### Faire un devis
1. **Devis → Nouveau devis**. Le client peut être créé sans quitter l'écran : bouton **Nouveau client** (il est enregistré puis sélectionné automatiquement). Pour un professionnel, tapez le nom de la société ou le SIRET : adresse, SIRET et n° de TVA se remplissent seuls.
2. Trouvez le véhicule en tapant sa **plaque**, son VIN ou le nom du client : le client est renseigné automatiquement. Sinon **Nouveau véhicule**. Indiquez le **kilométrage** et le **prochain CT** si besoin. Pour un devis de pièces, le véhicule est facultatif.
3. Ajoutez des lignes : forfaits, main d'œuvre et frais depuis la liste des tarifs, pièces par recherche dans le stock. Les totaux se calculent en direct. Une pièce dont la quantité dépasse le stock est refusée.
4. **Créer le devis** : il est en **Brouillon**. **Envoyer par e-mail** envoie le PDF au client et ne passe le devis à **Envoyé** que si l'e-mail est bien parti (sauvegarder ou imprimer ne change pas le statut). Il reste modifiable jusqu'à sa validation.
5. Quand le client accepte (devis Brouillon ou Envoyé), **Valider le devis** :
   - devis **mécanique** : choisissez le **technicien**, le **jour** et l'**heure** ; le rendez-vous est placé sur le planning, l'ordre de réparation est créé et le stock décrémenté. Si le créneau du technicien est pris, rien n'est modifié ;
   - devis de **pièces** : le stock est décrémenté et un **bon de livraison « en attente »** est créé (page Commandes et livraisons).
   Si une pièce manque, rien n'est modifié et la liste des manques s'affiche.
6. Si le client refuse : **Rejeter** avec un motif obligatoire.

Un devis validé est verrouillé. Seul l'administrateur peut le **Rouvrir** (tant que l'ordre n'est pas signé) : le stock est restitué.

### Facturer et encaisser
Sur un devis validé, **Créer la facture**. Sur la facture, **Enregistrer un paiement** (carte, espèces, chèque, virement, ou plusieurs fois : choisissez le nombre d'échéances, de 2 à 12) ; les paiements partiels sont permis. Statuts : Émise, Partiellement payée, Payée, Impayée (échéance dépassée). Un récapitulatif des impayés est envoyé chaque lundi.

### Stock
**Stock** : recherche par référence, nom, référence croisée ou taille de pneu. Les pièces au seuil d'alerte ou en dessous sont surlignées et listées sur le tableau de bord. **Commandes et livraisons** : quand une pièce atteint son seuil d'alerte, un **bon de commande « en attente »** est créé automatiquement (étiquette « Automatique », quantité = 2 × le seuil, fournisseur de la fiche pièce) ; modifiez-le si besoin, puis **Réceptionner** à l'arrivée (le stock augmente). Les bons de livraison des devis de pièces apparaissent « En attente » ; **Prêt à être retiré** puis **Marquer livré** (le client a récupéré ses pièces) : le bon de livraison (PDF sans prix) est alors **envoyé automatiquement par e-mail** au client et l'envoi est tracé dans son historique. Si l'e-mail ne peut pas partir (pas d'adresse, e-mails non configurés, erreur), le bon passe quand même « Livré » avec un avertissement, et **Renvoyer le BL** permet de réessayer. L'envoi de SMS est désactivé pour l'instant. Pour facturer : cochez un ou plusieurs bons **Livré** du même client puis **Transformer en facture** : une seule facture les regroupe.

### Importer et exporter les pièces
Sur la page **Stock** :
- **Exporter (Excel)** / **CSV** : télécharge la liste des pièces (les filtres de la page sont respectés). Le fichier exporté peut être réimporté tel quel.
- **Importer** : choisissez un fichier Excel (.xlsx) ou CSV dont la première ligne contient les titres de colonnes (la fenêtre rappelle le format et propose un modèle à télécharger). Cliquez sur **Analyser le fichier** : un aperçu indique les pièces à créer, à mettre à jour et les lignes en erreur avec leur motif. **Importer** applique les lignes valides ; les lignes en erreur sont listées pour correction.
- Une **référence déjà présente met la pièce à jour** (cellules vides = valeurs inchangées) et la quantité de la colonne **Stock est ajoutée** au stock actuel. Une nouvelle pièce exige désignation et prix de vente.

### Clients professionnels : réduction sur les pièces
Sur la fiche d'un client **Professionnel**, renseignez la **Réduction sur les pièces (%)**. Dans un devis pour ce client, chaque pièce du stock est automatiquement proposée au prix catalogue moins la réduction ; **la main d'œuvre, les forfaits et les frais divers ne sont jamais réduits**. Le prix reste modifiable à la main. Le devis, la facture et leur PDF indiquent le prix catalogue, le taux et le montant total de la remise.

### Campagnes (e-mails promotionnels)
Onglet **Campagnes** (Administrateur et Magasin) : créez une campagne (nom, destinataires, objet, message avec {prenom}, {nom}, {garage}), puis **Envoyer**. Seuls les clients ayant un e-mail **et** ayant accepté les offres (opt-in sur leur fiche) la reçoivent ; chaque e-mail contient un lien de désinscription qui retire immédiatement leur accord. L'envoi est tracé dans l'historique de chaque client. Une campagne déjà envoyée ne peut pas être renvoyée ; si certains envois échouent, **Relancer les échecs** ne réessaie que ceux-là. Il faut que la clé Brevo soit configurée.

### Planning
**Rendez-vous** : semaine par collaborateur (une couleur chacun, rappelée dans le formulaire). **Nouveau rendez-vous** (possible depuis un devis en attente) ; un collaborateur ne peut pas avoir deux rendez-vous en même temps. Cliquez un rendez-vous pour le confirmer, le déplacer, le marquer honoré/absent ou l'annuler. Des rappels J-7 et J-1 sont envoyés automatiquement.

### Factures : création manuelle, remise globale, virement
- **Factures → Nouvelle facture** : facture saisie directement (sans devis ni bon de livraison). Choisissez le client, ajoutez des pièces du stock (le stock est décrémenté à l'émission ; refus si le stock est insuffisant) et des lignes libres (main d'œuvre, forfait, frais). Annuler une facture manuelle restitue le stock.
- **Remise globale** (nouvelle facture, ou fenêtre « Créer la facture » depuis un devis ou des bons de livraison) : en **%** ou en **€**, calculée sur le **total HT** ou sur le **total TTC**. L'aperçu affiche le nouveau total ; la remise est tracée sur la facture et son PDF (total avant remise, remise, total). Elle se règle avant l'émission : une facture émise n'est plus modifiable (annulez-la et recréez-la).
- **Mode de règlement** : sur la facture, choisissez « Virement » pour que l'**IBAN et le BIC** du garage figurent sur le PDF (à saisir une fois dans **Paramètres**).
- **Recherche** : un devis se retrouve par le prénom, le nom ou « prénom nom » du client. Une recherche de pièce par **référence croisée** (espaces et tirets ignorés) remonte la pièce en stock avec sa référence principale, celles en stock d'abord.

### Fiche de contrôle (ordre de réparation)
Chaque ordre de réparation a une **fiche de contrôle** remplie par le technicien (voir Atelier). Quand il la valide, elle apparaît chez vous : pastille sur « Ordres de réparation », carte dans les alertes du tableau de bord, onglet « Fiches de contrôle à traiter ». Ouvrez l'ordre pour la lire, puis **Marquer comme traitée** (ou **Renvoyer à l'atelier** pour correction).

## Administrateur uniquement
- **Paramètres** : coordonnées bancaires (IBAN contrôlé, BIC) et liste des **points de la fiche de contrôle** (ajouter, renommer, réordonner, désactiver, supprimer). Chaque ordre reçoit une copie de la liste à la première ouverture ; modifier la liste ne change pas les fiches existantes.
- **Tarifs** : forfaits, puis main d'œuvre, puis frais divers.
- **Collaborateurs** : créer des comptes, changer un rôle, désactiver, réinitialiser un mot de passe, et choisir la **couleur** de chaque collaborateur (sélecteur de couleur ; sans choix, une couleur automatique est attribuée). Cette couleur sert dans le planning, la liste de choix des rendez-vous et le graphique « CA par collaborateur ».
- **Analyse** : chiffre d'affaires, marge, CA par collaborateur, pièces les plus vendues, export CSV.
- **Anonymiser un client** (fiche client) : droit à l'oubli ; les factures sont conservées.
- Voir les marges (le prix d'achat des pièces est visible par l'administrateur et le Magasin, jamais par l'Atelier).

## Atelier (tablette)
**Mes ordres de réparation** : touchez un ordre.
1. Faites signer le client si l'ordre est « En attente de signature ».
2. **Démarrer le pointage** ; **Arrêter** à la fin ou en pause (un seul pointage à la fois).
3. Cochez les tâches faites, **Ajouter une photo** au besoin.
4. Remplissez la **fiche de contrôle** : pour chaque point, OK / À surveiller / Défaut, plus les remarques. **Enregistrer** garde un brouillon ; **Valider et transmettre au Magasin** (tous les points renseignés) la verrouille et la rend visible au Magasin.
5. **Terminer l'ordre** quand le travail est fini.

**Rendez-vous** (menu de gauche) : votre planning de la semaine, en lecture seule.

Vous ne voyez ni les prix ni les marges.
