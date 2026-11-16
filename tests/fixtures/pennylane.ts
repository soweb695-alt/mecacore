// Extrait au format de l'export « Clients » de Pennylane (données inventées).
const ENTETE = "Rôle;Identifiant Client;Dénomination;Siren;Numéro de Compte;Adresse;Code Postal;Ville;Pays;Liste d’e-mails;Téléphone;Référence Client;Destinataire;Prénom;Nom;Sexe;Adresse de Livraison;Code Postal de Livraison;Ville de Livraison;Pays de Livraison;Remarques;Numéro de TVA;Axe analytique;Catégorie/Tag;Langue de Facturation;Conditions de Paiement;Type de Client;Nombre de factures;Chiffre d’affaires (€)";
export const CSV_PENNYLANE = [
  ENTETE,
  'Client;id-1;Jean DUPONT;;411100001;3 rue des Lilas;69001;Lyon;FR;"jean@exemple.fr, autre@exemple.fr";0601020304;"";"";Jean;DUPONT;;"5 rue Livraison";"75001";"Paris";"";"";"";"";"";fr_FR;Payable dès réception;Particulier;2;120,0',
  "Client;id-2;GARAGE DU PONT;832835250;411100002;Zone Nord;69520;GRIGNY;FR;contact@pont.fr;\"\";\"\";\"\";\"\";\"\";;\"\";\"\";\"\";\"\";\"\";FR35832835250;\"\";\"\";fr_FR;Paiement sous 30 jours;Entreprise;12;5765,0",
  "Client;id-3;Alpha Transports;FR 12 TVA PAS UN SIREN;411100003;;;;CH;pas-un-email;\"\";\"\";\"\";\"\";\"\";;\"\";\"\";\"\";\"\";\"\";\"\";\"\";\"\";fr_FR;Payable dès réception;Entreprise;0;0,0",
  "Client;id-4;;;;;;;FR;;;;;;;;;;;;;;;;fr_FR;Payable dès réception;Particulier;0;0,0",
].join("\n");
