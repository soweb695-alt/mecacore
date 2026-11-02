import { describe, expect, it } from "vitest";
import { ROLE_LABELS, navFor } from "@/lib/permissions";
import { trierTarifs } from "@/lib/tarifs";
import { paiementSchema } from "@/lib/validators/facture";
import { quantiteAReapprovisionner } from "@/lib/services/reappro";

describe("navigation et libellés", () => {
  it("place Clients et Véhicules après l'Atelier (devis, OR, rendez-vous)", () => {
    const hrefs = navFor({ id: "a", role: "ADMIN" }).map((i) => i.href);
    expect(hrefs.indexOf("/devis")).toBeLessThan(hrefs.indexOf("/clients"));
    expect(hrefs.indexOf("/rendez-vous")).toBeLessThan(hrefs.indexOf("/clients"));
    expect(hrefs.indexOf("/clients")).toBeLessThan(hrefs.indexOf("/vehicules"));
    expect(hrefs.indexOf("/vehicules")).toBeLessThan(hrefs.indexOf("/stock"));
  });
  it("nomme les rôles Magasin et Atelier", () => {
    expect(ROLE_LABELS).toEqual({ ADMIN: "Administrateur", SECRETARIAT: "Magasin", MECANICIEN: "Atelier" });
  });
});

describe("tarifs", () => {
  it("propose d'abord les forfaits, puis la main d'œuvre, puis les frais divers", () => {
    const tri = trierTarifs([
      { type: "FRAIS_DIVERS", libelle: "Environnement" },
      { type: "MO2", libelle: "MO2" },
      { type: "FORFAIT", libelle: "Vidange" },
      { type: "MO1", libelle: "MO1" },
      { type: "FORFAIT", libelle: "Diagnostic" },
    ]);
    expect(tri.map((t) => t.libelle)).toEqual(["Diagnostic", "Vidange", "MO1", "MO2", "Environnement"]);
  });
});

describe("paiement en plusieurs fois", () => {
  it("exige le nombre de fois (2 à 12)", () => {
    expect(paiementSchema.safeParse({ montant: 100, mode: "PLUSIEURS_FOIS" }).success).toBe(false);
    expect(paiementSchema.safeParse({ montant: 100, mode: "PLUSIEURS_FOIS", nombreFois: 1 }).success).toBe(false);
    expect(paiementSchema.safeParse({ montant: 100, mode: "PLUSIEURS_FOIS", nombreFois: 13 }).success).toBe(false);
    expect(paiementSchema.safeParse({ montant: 100, mode: "PLUSIEURS_FOIS", nombreFois: 3 }).success).toBe(true);
    expect(paiementSchema.safeParse({ montant: 100, mode: "CB" }).success).toBe(true);
  });
});

describe("quantité à recommander", () => {
  it("remonte à 2 × le seuil, au moins 1", () => {
    expect(quantiteAReapprovisionner(2, 5)).toBe(8);
    expect(quantiteAReapprovisionner(0, 4)).toBe(8);
    expect(quantiteAReapprovisionner(9, 5)).toBe(1);
  });
});
