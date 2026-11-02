import { round2 } from "@/lib/money";

export interface LigneRemise {
  quantite: number;
  prixUnitaireHT: number;
  prixCatalogueHT: number | null;
}

/** Montant HT total de la réduction professionnelle déjà déduite (Σ (prix catalogue − prix net) × quantité). */
export function montantRemise(lignes: LigneRemise[]): number {
  return round2(
    lignes.reduce((s, l) => (l.prixCatalogueHT !== null && l.prixCatalogueHT > l.prixUnitaireHT ? s + (l.prixCatalogueHT - l.prixUnitaireHT) * l.quantite : s), 0),
  );
}

/** Taux effectif (%) d'une ligne : (catalogue − net) / catalogue. */
export function tauxRemiseLigne(l: Pick<LigneRemise, "prixUnitaireHT" | "prixCatalogueHT">): number {
  if (l.prixCatalogueHT === null || l.prixCatalogueHT <= 0 || l.prixCatalogueHT <= l.prixUnitaireHT) return 0;
  return Math.round(((l.prixCatalogueHT - l.prixUnitaireHT) / l.prixCatalogueHT) * 1000) / 10;
}
