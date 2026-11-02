// Identité de l'application (module pur, utilisable côté serveur et client).
// NEXT_PUBLIC_* est intégré au build : changer le nom demande de reconstruire l'application.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "MecaCore";
export const APP_TAGLINE = "Le cerveau de votre garage";
/** Couleurs du logo. */
export const APP_COULEUR = "#1E3A8A";
