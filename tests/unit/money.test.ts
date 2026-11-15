import { describe, expect, it } from "vitest";
import { appliquerRemisePro, calculerTotaux, montantsLigne, prixHTDepuisTTC, prixLigne, prixTTCDepuisHT, totalLigneHT } from "@/lib/money";

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

  it("arrondit à 2 décimales (PU TTC au centime, déduit du HT pour les anciennes lignes)", () => {
    expect(totalLigneHT({ quantite: 3, prixUnitaireHT: 0.1, tvaRate: 0 })).toBe(0.3);
    // 33,33 HT → PU TTC 40,00 (39,996 arrondi) : la ligne vaut 120,00 TTC, dont 100,00 HT.
    const t = calculerTotaux([{ quantite: 3, prixUnitaireHT: 33.33, tvaRate: 20 }]);
    expect(t).toEqual({ totalHT: 100, totalTVA: 20, totalTTC: 120 });
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

describe("le TTC saisi fait foi (bug DEV-2026-0006 : 35,00 € affiché 34,99 €)", () => {
  it("2 × 17,50 € TTC = 35,00 € TTC (et non 34,99 €)", () => {
    const l = { quantite: 2, prixUnitaireHT: prixHTDepuisTTC(17.5, 20), prixUnitaireTTC: 17.5, tvaRate: 20 };
    expect(l.prixUnitaireHT).toBe(14.58);
    expect(calculerTotaux([l])).toEqual({ totalHT: 29.17, totalTVA: 5.83, totalTTC: 35 });
  });

  it("35,00 € TTC saisi reste 35,00 € quelle que soit la TVA", () => {
    for (const tva of [20, 10, 5.5, 2.1, 0]) {
      expect(montantsLigne({ quantite: 1, prixUnitaireHT: 0, prixUnitaireTTC: 35, tvaRate: tva }).totalTTC).toBe(35);
    }
  });

  it("HT + TVA = TTC au centime sur un devis à plusieurs lignes", () => {
    const t = calculerTotaux([
      { quantite: 3, prixUnitaireHT: 0, prixUnitaireTTC: 11.99, tvaRate: 20 },
      { quantite: 1.5, prixUnitaireHT: 0, prixUnitaireTTC: 78, tvaRate: 20 },
      { quantite: 1, prixUnitaireHT: 0, prixUnitaireTTC: 9.99, tvaRate: 5.5 },
    ]);
    expect(t.totalTTC).toBe(162.96);
    expect(Math.round((t.totalHT + t.totalTVA) * 100)).toBe(16296);
  });

  it("une saisie HT donne un PU TTC au centime, qui fait ensuite foi", () => {
    expect(prixTTCDepuisHT(29.17, 20)).toBe(35);
    expect(prixTTCDepuisHT(14.58, 20)).toBe(17.5);
    expect(prixLigne({ quantite: 2, prixUnitaireHT: 14.58, tvaRate: 20 })).toEqual({ prixUnitaireTTC: 17.5, prixUnitaireHT: 14.58, totalHT: 29.17 });
  });

  it("prixLigne déduit le PU HT du TTC envoyé, sans se fier au HT reçu", () => {
    expect(prixLigne({ quantite: 1, prixUnitaireHT: 999, prixUnitaireTTC: 35, tvaRate: 20 })).toEqual({ prixUnitaireTTC: 35, prixUnitaireHT: 29.17, totalHT: 29.17 });
  });
});
