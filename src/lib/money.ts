// Calculs monétaires en centimes entiers : pas d'erreur d'arrondi flottant.

export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LigneCalcul {
  quantite: number;
  prixUnitaireHT: number;
  tvaRate: number;
}

export interface Totaux {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/** Total HT d'une ligne : quantité × prix unitaire, arrondi au centime. */
export function totalLigneHT(l: Pick<LigneCalcul, "quantite" | "prixUnitaireHT">): number {
  return fromCents(Math.round(l.quantite * toCents(l.prixUnitaireHT)));
}

/**
 * totalHT = Σ(quantité × PU) ; totalTVA = Σ(ligneHT × taux / 100) ; totalTTC = HT + TVA.
 * Arrondi à 2 décimales sur le total (TVA calculée sur la somme exacte des lignes).
 */
export function calculerTotaux(lignes: LigneCalcul[]): Totaux {
  let ht = 0;
  let tva = 0;
  for (const l of lignes) {
    const ligneCents = Math.round(l.quantite * toCents(l.prixUnitaireHT));
    ht += ligneCents;
    tva += (ligneCents * l.tvaRate) / 100;
  }
  const totalHT = fromCents(ht);
  const totalTVA = fromCents(Math.round(tva));
  return { totalHT, totalTVA, totalTTC: round2(totalHT + totalTVA) };
}

/** Remise PRO : appliquée sur le prix unitaire HT des seules lignes de type PIECE. */
export function appliquerRemisePro(prixUnitaireHT: number, tauxRemise: number): number {
  if (tauxRemise <= 0) return prixUnitaireHT;
  return fromCents(Math.round(toCents(prixUnitaireHT) * (1 - tauxRemise / 100)));
}

export const formatEUR = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export interface RemiseGlobale {
  type: "EUROS" | "POURCENT";
  /** Base de calcul : le total HT ou le total TTC. */
  base: "HT" | "TTC";
  valeur: number;
}

export interface TotauxRemise extends Totaux {
  /** Montant déduit, exprimé sur la base choisie (HT ou TTC). */
  montantRemise: number;
  /** Total HT avant remise globale. */
  totalHTAvantRemise: number;
}

/**
 * Remise globale sur une facture. Sur le HT, la TVA est recalculée au prorata ; sur le TTC, le total TTC baisse du
 * montant exact et la TVA est déduite de l'écart (HT proratisé). Tout en centimes, sans erreur d'arrondi.
 */
export function appliquerRemiseGlobale(t: Totaux, r: RemiseGlobale | null | undefined): TotauxRemise {
  const ht = toCents(t.totalHT);
  const tva = toCents(t.totalTVA);
  const ttc = ht + tva;
  if (!r || r.valeur <= 0) return { ...t, totalTTC: fromCents(ttc), montantRemise: 0, totalHTAvantRemise: t.totalHT };
  const base = r.base === "HT" ? ht : ttc;
  const d = r.type === "EUROS" ? toCents(r.valeur) : Math.round((base * r.valeur) / 100);
  if (d >= base) throw new RangeError("La remise doit être inférieure au total");
  const reste = base - d;
  let newHT: number;
  let newTVA: number;
  if (r.base === "HT") {
    newHT = reste;
    newTVA = Math.round((tva * reste) / base);
  } else {
    newHT = Math.round((ht * reste) / base);
    newTVA = reste - newHT;
  }
  return { totalHT: fromCents(newHT), totalTVA: fromCents(newTVA), totalTTC: fromCents(newHT + newTVA), montantRemise: fromCents(d), totalHTAvantRemise: t.totalHT };
}
