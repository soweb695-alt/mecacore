-- Modèles d'e-mails « Véhicule prêt » et « Rappel de rendez-vous » (vide : texte par défaut).
ALTER TABLE "ParametreGarage" ADD COLUMN "emailVehiculePretSujet" TEXT, ADD COLUMN "emailVehiculePretCorps" TEXT, ADD COLUMN "emailRappelRdvSujet" TEXT, ADD COLUMN "emailRappelRdvCorps" TEXT;
