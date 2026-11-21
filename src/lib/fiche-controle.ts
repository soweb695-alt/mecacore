// Fiche de contrôle par catégories : statuts proposés selon le type de la catégorie. Module pur (client et serveur).

export type TypeStatuts = "OK_ABIME" | "OK_NC" | "OK_A_REPARER" | "CASE";
export type Resultat = "NON_VERIFIE" | "OK" | "A_SURVEILLER" | "DEFAUT" | "ABIME" | "NON_CONFORME" | "A_REPARER" | "NON_CONCERNE";

export const TYPES_STATUTS: TypeStatuts[] = ["OK_ABIME", "OK_NC", "OK_A_REPARER", "CASE"];

/** Colonnes de statut de chaque type (dans l'ordre d'affichage, à l'écran et sur le PDF). */
export const COLONNES: Record<TypeStatuts, { valeur: Resultat; libelle: string }[]> = {
  OK_ABIME: [
    { valeur: "OK", libelle: "Ok" },
    { valeur: "ABIME", libelle: "Abîmé" },
  ],
  OK_NC: [
    { valeur: "OK", libelle: "Ok" },
    { valeur: "NON_CONFORME", libelle: "N.C." },
  ],
  OK_A_REPARER: [
    { valeur: "OK", libelle: "Ok" },
    { valeur: "A_REPARER", libelle: "À réparer" },
  ],
  CASE: [{ valeur: "OK", libelle: "Ok" }],
};

/** Libellé du type dans les Paramètres. */
export const LIBELLE_TYPE: Record<TypeStatuts, string> = {
  OK_ABIME: "Ok / Abîmé",
  OK_NC: "Ok / N.C.",
  OK_A_REPARER: "Ok / À réparer",
  CASE: "Case à cocher (Ok)",
};

/** Ancien modèle (fiches créées avant les catégories). */
export const COLONNES_ANCIEN: { valeur: Resultat; libelle: string }[] = [
  { valeur: "OK", libelle: "OK" },
  { valeur: "A_SURVEILLER", libelle: "À surveiller" },
  { valeur: "DEFAUT", libelle: "Défaut" },
];

export const LIBELLE_NON_CONCERNE = "N/A";

/** Résultats acceptés pour un point d'un type donné (null : ancien modèle). */
export function resultatsAutorises(type: TypeStatuts | null): Resultat[] {
  if (type === null) return ["NON_VERIFIE", ...COLONNES_ANCIEN.map((c) => c.valeur)];
  if (type === "CASE") return ["NON_VERIFIE", "OK"];
  return ["NON_VERIFIE", ...COLONNES[type].map((c) => c.valeur), "NON_CONCERNE"];
}

/** Un point est renseigné s'il a un statut ; une case à cocher décochée est une réponse (élément absent). */
export function pointRenseigne(type: TypeStatuts | null, resultat: Resultat): boolean {
  return type === "CASE" || resultat !== "NON_VERIFIE";
}

/** Croix placée sur le croquis du véhicule, en fraction de la largeur et de la hauteur (0 à 1). */
export interface Dommage {
  x: number;
  y: number;
}

export const MAX_DOMMAGES = 40;

/** Lecture tolérante du JSON stocké. */
export function lireDommages(v: unknown): Dommage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((d): d is Dommage => !!d && typeof d === "object" && typeof (d as Dommage).x === "number" && typeof (d as Dommage).y === "number")
    .slice(0, MAX_DOMMAGES)
    .map((d) => ({ x: Math.min(1, Math.max(0, d.x)), y: Math.min(1, Math.max(0, d.y)) }));
}

/** Points d'une fiche regroupés par catégorie, dans l'ordre du modèle. */
export function grouperParCategorie<P extends { categorie: string | null; categoriePosition: number; typeStatuts: TypeStatuts | null }>(points: P[]) {
  const groupes: { categorie: string; typeStatuts: TypeStatuts; points: P[] }[] = [];
  for (const p of [...points].sort((a, b) => a.categoriePosition - b.categoriePosition)) {
    const nom = p.categorie ?? "Contrôle";
    const g = groupes.find((x) => x.categorie === nom);
    if (g) g.points.push(p);
    else groupes.push({ categorie: nom, typeStatuts: p.typeStatuts ?? "OK_A_REPARER", points: [p] });
  }
  return groupes;
}
