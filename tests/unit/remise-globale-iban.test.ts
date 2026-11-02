import { describe, expect, it } from "vitest";
import { appliquerRemiseGlobale } from "@/lib/money";
import { banqueSchema, ibanValide } from "@/lib/validators/parametres";
import { remiseGlobaleSchema } from "@/lib/validators/facture";

const t = { totalHT: 100, totalTVA: 20, totalTTC: 120 };

describe("remise globale", () => {
  it("sans remise : totaux inchangés", () => {
    expect(appliquerRemiseGlobale(t, null)).toMatchObject({ totalHT: 100, totalTVA: 20, totalTTC: 120, montantRemise: 0 });
  });
  it("10 % sur le HT : la TVA suit", () => {
    expect(appliquerRemiseGlobale(t, { type: "POURCENT", base: "HT", valeur: 10 })).toMatchObject({ totalHT: 90, totalTVA: 18, totalTTC: 108, montantRemise: 10, totalHTAvantRemise: 100 });
  });
  it("20 € sur le HT", () => {
    expect(appliquerRemiseGlobale(t, { type: "EUROS", base: "HT", valeur: 20 })).toMatchObject({ totalHT: 80, totalTVA: 16, totalTTC: 96 });
  });
  it("12 € sur le TTC : le TTC baisse exactement de 12 €", () => {
    const r = appliquerRemiseGlobale(t, { type: "EUROS", base: "TTC", valeur: 12 });
    expect(r.totalTTC).toBe(108);
    expect(r.totalHT + r.totalTVA).toBeCloseTo(108, 10);
    expect(r.totalHT).toBe(90);
    expect(r.montantRemise).toBe(12);
  });
  it("10 % sur le TTC", () => {
    const r = appliquerRemiseGlobale(t, { type: "POURCENT", base: "TTC", valeur: 10 });
    expect(r.totalTTC).toBe(108);
    expect(r.montantRemise).toBe(12);
  });
  it("refuse une remise égale ou supérieure au total", () => {
    expect(() => appliquerRemiseGlobale(t, { type: "EUROS", base: "HT", valeur: 100 })).toThrow();
    expect(() => appliquerRemiseGlobale(t, { type: "EUROS", base: "TTC", valeur: 500 })).toThrow();
  });
  it("valide le schéma (pourcentage < 100, pas de valeur négative)", () => {
    expect(remiseGlobaleSchema.safeParse({ type: "POURCENT", base: "HT", valeur: 100 }).success).toBe(false);
    expect(remiseGlobaleSchema.safeParse({ type: "EUROS", base: "HT", valeur: -1 }).success).toBe(false);
    expect(remiseGlobaleSchema.safeParse({ type: "POURCENT", base: "TTC", valeur: 12.5 }).success).toBe(true);
  });
});

describe("IBAN / BIC", () => {
  it("contrôle la clé IBAN", () => {
    expect(ibanValide("FR14 2004 1010 0505 0001 3M02 606")).toBe(true);
    expect(ibanValide("FR14 2004 1010 0505 0001 3M02 607")).toBe(false);
    expect(ibanValide("n'importe quoi")).toBe(false);
  });
  it("normalise et accepte le vide", () => {
    expect(banqueSchema.parse({ iban: "fr14 2004 1010 0505 0001 3m02 606", bic: "psst frpp" })).toEqual({ iban: "FR1420041010050500013M02606", bic: "PSSTFRPP" });
    expect(banqueSchema.parse({ iban: "", bic: "" })).toEqual({ iban: "", bic: "" });
    expect(banqueSchema.safeParse({ iban: "FR00", bic: "" }).success).toBe(false);
    expect(banqueSchema.safeParse({ iban: "", bic: "XX" }).success).toBe(false);
  });
});
