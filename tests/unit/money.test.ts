import { describe, expect, it } from "vitest";
import { appliquerRemisePro, calculerTotaux, totalLigneHT } from "@/lib/money";

describe("calculs de devis", () => {
  it("calcule HT, TVA et TTC sans erreur de flottant", () => {
    const t = calculerTotaux([
      { quantite: 1.5, prixUnitaireHT: 65, tvaRate: 20 },
      { quantite: 4, prixUnitaireHT: 49.9, tvaRate: 20 },
      { quantite: 1, prixUnitaireHT: 9.9, tvaRate: 20 },
    ]);
    expect(t.totalHT).toBe(307);
    expect(t.totalTVA).toBe(61.4);
    expect(t.totalTTC).toBe(368.4);
  });

  it("gère plusieurs taux de TVA", () => {
    const t = calculerTotaux([
      { quantite: 1, prixUnitaireHT: 100, tvaRate: 20 },
      { quantite: 1, prixUnitaireHT: 100, tvaRate: 5.5 },
    ]);
    expect(t).toEqual({ totalHT: 200, totalTVA: 25.5, totalTTC: 225.5 });
  });

  it("arrondit à 2 décimales", () => {
    expect(totalLigneHT({ quantite: 3, prixUnitaireHT: 0.1 })).toBe(0.3);
    const t = calculerTotaux([{ quantite: 3, prixUnitaireHT: 33.33, tvaRate: 20 }]);
    expect(t.totalHT).toBe(99.99);
    expect(t.totalTVA).toBe(20);
    expect(t.totalTTC).toBe(119.99);
  });

  it("applique la remise PRO sur le prix unitaire", () => {
    expect(appliquerRemisePro(100, 10)).toBe(90);
    expect(appliquerRemisePro(49.9, 10)).toBe(44.91);
    expect(appliquerRemisePro(100, 0)).toBe(100);
  });

  it("renvoie zéro pour un devis vide", () => {
    expect(calculerTotaux([])).toEqual({ totalHT: 0, totalTVA: 0, totalTTC: 0 });
  });
});
