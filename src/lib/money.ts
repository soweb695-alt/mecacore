// Calculs monétaires en centimes entiers : pas d'erreur d'arrondi flottant.

export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LigneCalcul {
  quantite: number;
  prixUnitaireHT: number;
  /** Prix unitaire TTC saisi : c'est lui qui fait foi. Absent (anciennes lignes) : déduit du HT, arrondi au centime. */
  prixUnitaireTTC?: number | null;
  tvaRate: number;
}

export interface Totaux {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/** PU TTC au centime à partir d'un PU HT (catalogue, tarif, remise pro). */
export const prixTTCDepuisHT = (ht: number, tvaRate: number): number => fromCents(Math.round((toCents(ht) * (100 + tvaRate)) / 100));
/** PU HT au centime à partir d'un PU TTC saisi (affichage et colonne prixUnitaireHT). */
export const prixHTDepuisTTC = (ttc: number, tvaRate: number): number => fromCents(Math.round((toCents(ttc) * 100) / (100 + tvaRate)));

/** PU TTC qui fait foi pour une ligne. */
export function prixUnitaireTTC(l: Pick<LigneCalcul, "prixUnitaireHT" | "prixUnitaireTTC" | "tvaRate">): number {
  return l.prixUnitaireTTC != null ? l.prixUnitaireTTC : prixTTCDepuisHT(l.prixUnitaireHT, l.tvaRate);
}

/**
 * Montants d'une ligne, le TTC faisant foi : TTC = quantité × PU TTC (au centime), HT = TTC ÷ (1 + taux) au centime,
 * TVA = TTC − HT. Le TTC affiché est ainsi toujours celui saisi (35,00 € reste 35,00 €).
 */
export function montantsLigne(l: LigneCalcul): Totaux {
  const ttc = Math.round(l.quantite * toCents(prixUnitaireTTC(l)));
  const ht = Math.round((ttc * 100) / (100 + l.tvaRate));
  return { totalHT: fromCents(ht), totalTVA: fromCents(ttc - ht), totalTTC: fromCents(ttc) };
}

/** Total HT d'une ligne (déduit de son TTC). */
export function totalLigneHT(l: LigneCalcul): number {
  return montantsLigne(l).totalHT;
}

/** Colonnes de prix à enregistrer pour une ligne : PU TTC (fait foi), PU HT déduit, total HT de la ligne. */
export function prixLigne(l: LigneCalcul): { prixUnitaireTTC: number; prixUnitaireHT: number; totalHT: number } {
  const ttc = prixUnitaireTTC(l);
  return {
    prixUnitaireTTC: ttc,
    prixUnitaireHT: l.prixUnitaireTTC != null ? prixHTDepuisTTC(ttc, l.tvaRate) : l.prixUnitaireHT,
    totalHT: montantsLigne(l).totalHT,
  };
}

/** Totaux = somme des montants de lignes (en centimes) : totalTTC = Σ TTC saisis, totalHT + totalTVA = totalTTC. */
export function calculerTotaux(lignes: LigneCalcul[]): Totaux {
  let ht = 0;
  let ttc = 0;
  for (const l of lignes) {
    const m = montantsLigne(l);
    ht += toCents(m.totalHT);
    ttc += toCents(m.totalTTC);
  }
  return { totalHT: fromCents(ht), totalTVA: fromCents(ttc - ht), totalTTC: fromCents(ttc) };
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

/** Marge sur prix de vente HT : montant (€ HT) et taux sur le prix de vente (%, 1 décimale). */
export function calculerMarge(venteHT: number, achatHT: number): { montant: number; pct: number } {
  const montant = fromCents(toCents(venteHT) - toCents(achatHT));
  return { montant, pct: venteHT > 0 ? Math.round((montant / venteHT) * 1000) / 10 : 0 };
}

/** « 12,40 € HT · 31 % » */
export const formatMarge = (m: { montant: number; pct: number }): string =>
  `${formatEUR(m.montant)} HT · ${m.pct.toLocaleString("fr-FR")} %`;
