import { esc } from "@/lib/messages/templates";
import { JOURS, lireHoraires } from "@/lib/validators/parametres";

export type CleModele = "vehiculePret" | "rappelRdv";

export interface ModeleEmail {
  sujet: string;
  corps: string;
}

/** Variable insérable dans un modèle, avec son libellé (boutons d'insertion des Paramètres). */
export interface VariableModele {
  nom: string;
  libelle: string;
}

const VARS_COMMUNES: VariableModele[] = [
  { nom: "client_nom", libelle: "Nom du client" },
  { nom: "vehicule", libelle: "Véhicule" },
  { nom: "immatriculation", libelle: "Immatriculation" },
  { nom: "garage_nom", libelle: "Nom du garage" },
  { nom: "garage_adresse", libelle: "Adresse du garage" },
  { nom: "garage_telephone", libelle: "Téléphone du garage" },
  { nom: "horaires", libelle: "Horaires" },
];

/** Variables utilisables dans chaque modèle, écrites {{nom}} (remplacées à l'envoi). */
export const VARIABLES: Record<CleModele, VariableModele[]> = {
  vehiculePret: VARS_COMMUNES,
  rappelRdv: [...VARS_COMMUNES.slice(0, 3), { nom: "date_rdv", libelle: "Date du RDV" }, { nom: "heure_rdv", libelle: "Heure du RDV" }, ...VARS_COMMUNES.slice(3)],
};

/** Anciens noms ({client}, {date}…) : les modèles saisis avant les Paramètres › Communication restent valides. */
const ALIAS: Record<string, string> = {
  client: "client_nom",
  garage: "garage_nom",
  adresse: "garage_adresse",
  telephone: "garage_telephone",
  date: "date_rdv",
  heure: "heure_rdv",
  vehicule: "vehicule",
  immatriculation: "immatriculation",
  horaires: "horaires",
};

/** Textes par défaut, utilisés tant que le garage n'a pas personnalisé ses modèles (Paramètres › Communication). */
export const MODELES_DEFAUT: Record<CleModele, ModeleEmail> = {
  vehiculePret: {
    sujet: "Votre {{vehicule}} ({{immatriculation}}) est prêt",
    corps:
      "Bonjour {{client_nom}},\n\nLes travaux sur votre {{vehicule}} ({{immatriculation}}) sont terminés : vous pouvez venir le récupérer.\n\nNos horaires :\n{{horaires}}\n\nÀ bientôt,\n{{garage_nom}}\n{{garage_adresse}} · {{garage_telephone}}",
  },
  rappelRdv: {
    sujet: "Rappel : rendez-vous le {{date_rdv}} à {{heure_rdv}}",
    corps:
      "Bonjour {{client_nom}},\n\nNous vous rappelons votre rendez-vous au garage le {{date_rdv}} à {{heure_rdv}} pour votre {{vehicule}} ({{immatriculation}}).\n\nPour le déplacer, appelez-nous au {{garage_telephone}}.\n\nÀ bientôt,\n{{garage_nom}}\n{{garage_adresse}}",
  },
};

/** Modèle effectif : texte du garage, ou texte par défaut pour un champ vide. */
export function modele(cle: CleModele, perso: { sujet?: string | null; corps?: string | null }): ModeleEmail {
  return { sujet: perso.sujet?.trim() || MODELES_DEFAUT[cle].sujet, corps: perso.corps?.trim() || MODELES_DEFAUT[cle].corps };
}

/** Remplace {{nom}} (et l'ancienne forme {nom}) ; une variable inconnue est laissée telle quelle. */
const remplacer = (texte: string, vars: Record<string, string>, f: (v: string) => string) =>
  texte.replace(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g, (m, double: string | undefined, simple: string | undefined) => {
    const nom = double ?? ALIAS[simple!] ?? simple!;
    return nom in vars ? f(vars[nom]) : m;
  });

/** Sujet en texte brut, corps en HTML : les valeurs et le texte saisi sont échappés, les retours à la ligne conservés. */
export function rendreModele(m: ModeleEmail, vars: Record<string, string>): { subject: string; html: string } {
  const subject = remplacer(m.sujet, vars, (v) => v).replace(/[\r\n]+/g, " ");
  const corps = remplacer(esc(m.corps), vars, esc);
  const html = corps
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return { subject, html };
}

const LIB_JOURS: Record<(typeof JOURS)[number], string> = { lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi", vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche" };

/** Horaires sur plusieurs lignes (« Lundi : 08:00-18:00 »), jours vides ignorés. */
export function texteHoraires(v: unknown): string {
  const h = lireHoraires(v);
  return JOURS.filter((j) => h[j]).map((j) => `${LIB_JOURS[j]} : ${h[j]}`).join("\n");
}
