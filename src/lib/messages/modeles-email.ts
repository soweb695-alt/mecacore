import { esc } from "@/lib/messages/templates";
import { JOURS, lireHoraires } from "@/lib/validators/parametres";

export type CleModele = "vehiculePret" | "rappelRdv";

export interface ModeleEmail {
  sujet: string;
  corps: string;
}

/** Variables utilisables dans les modèles (remplacées à l'envoi). */
export const VARIABLES: Record<CleModele, string[]> = {
  vehiculePret: ["client", "vehicule", "immatriculation", "garage", "adresse", "telephone", "horaires"],
  rappelRdv: ["client", "vehicule", "immatriculation", "date", "heure", "garage", "adresse", "telephone", "horaires"],
};

/** Textes par défaut, utilisés tant que le garage n'a pas personnalisé ses modèles dans « Mon Garage ». */
export const MODELES_DEFAUT: Record<CleModele, ModeleEmail> = {
  vehiculePret: {
    sujet: "Votre {vehicule} ({immatriculation}) est prêt",
    corps:
      "Bonjour {client},\n\nLes travaux sur votre {vehicule} ({immatriculation}) sont terminés : vous pouvez venir le récupérer.\n\nNos horaires :\n{horaires}\n\nÀ bientôt,\n{garage}\n{adresse} · {telephone}",
  },
  rappelRdv: {
    sujet: "Rappel : rendez-vous le {date} à {heure}",
    corps:
      "Bonjour {client},\n\nNous vous rappelons votre rendez-vous au garage le {date} à {heure} pour votre {vehicule} ({immatriculation}).\n\nPour le déplacer, appelez-nous au {telephone}.\n\nÀ bientôt,\n{garage}\n{adresse}",
  },
};

/** Modèle effectif : texte du garage, ou texte par défaut pour un champ vide. */
export function modele(cle: CleModele, perso: { sujet?: string | null; corps?: string | null }): ModeleEmail {
  return { sujet: perso.sujet?.trim() || MODELES_DEFAUT[cle].sujet, corps: perso.corps?.trim() || MODELES_DEFAUT[cle].corps };
}

const remplacer = (texte: string, vars: Record<string, string>, f: (v: string) => string) =>
  texte.replace(/\{(\w+)\}/g, (m, nom: string) => (nom in vars ? f(vars[nom]) : m));

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
