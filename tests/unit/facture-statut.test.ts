import { describe, expect, it } from "vitest";
import { ajouterJours, calculerStatutFacture } from "@/lib/facture-statut";

const now = new Date("2026-10-25T10:00:00Z");
const futur = ajouterJours(now, 10);
const passe = ajouterJours(now, -3);

describe("statut de facture", () => {
  it("EMISE si rien n'est payé et l'échéance n'est pas dépassée", () => {
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 0, dateEcheance: futur }, now)).toBe("EMISE");
  });
  it("PARTIELLEMENT_PAYEE si paiement partiel dans les délais", () => {
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 40, dateEcheance: futur }, now)).toBe("PARTIELLEMENT_PAYEE");
  });
  it("PAYEE dès que le montant payé atteint le total", () => {
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 100, dateEcheance: futur }, now)).toBe("PAYEE");
    expect(calculerStatutFacture({ totalTTC: 99.99, montantPaye: 99.99, dateEcheance: passe }, now)).toBe("PAYEE");
  });
  it("IMPAYEE si l'échéance est dépassée avec un solde restant", () => {
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 0, dateEcheance: passe }, now)).toBe("IMPAYEE");
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 60, dateEcheance: passe }, now)).toBe("IMPAYEE");
  });
  it("ne recalcule jamais une facture annulée", () => {
    expect(calculerStatutFacture({ totalTTC: 100, montantPaye: 0, dateEcheance: passe, statut: "ANNULEE" }, now)).toBe("ANNULEE");
  });
  it("gère les centimes sans erreur de flottant", () => {
    expect(calculerStatutFacture({ totalTTC: 0.3, montantPaye: 0.1 + 0.2, dateEcheance: futur }, now)).toBe("PAYEE");
  });
});
