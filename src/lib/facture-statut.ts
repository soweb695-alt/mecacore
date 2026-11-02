export type StatutFacture = "BROUILLON" | "EMISE" | "PARTIELLEMENT_PAYEE" | "PAYEE" | "IMPAYEE" | "ANNULEE";

/**
 * Statut calculé d'une facture (montants en euros, arrondis au centime) :
 *  - montantPaye ≥ totalTTC                       → PAYEE
 *  - échéance dépassée et solde restant           → IMPAYEE
 *  - 0 < montantPaye < totalTTC (dans les délais) → PARTIELLEMENT_PAYEE
 *  - montantPaye = 0                              → EMISE
 * Une facture ANNULEE ou BROUILLON (non émise) n'est jamais recalculée.
 */
export function calculerStatutFacture(
  f: { totalTTC: number; montantPaye: number; dateEcheance: Date; statut?: StatutFacture },
  now: Date = new Date(),
): StatutFacture {
  if (f.statut === "ANNULEE" || f.statut === "BROUILLON") return f.statut;
  const total = Math.round(f.totalTTC * 100);
  const paye = Math.round(f.montantPaye * 100);
  if (paye >= total) return "PAYEE";
  if (f.dateEcheance.getTime() < now.getTime()) return "IMPAYEE";
  if (paye > 0) return "PARTIELLEMENT_PAYEE";
  return "EMISE";
}

export function ajouterJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * 24 * 3600 * 1000);
}
