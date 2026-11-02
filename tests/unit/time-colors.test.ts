import { describe, expect, it } from "vitest";
import { PALETTE, couleurCollaborateur } from "@/lib/colors";
import { ajouterJoursStr, lundiDe, parisVersUtc, utcVersParis } from "@/lib/time";

describe("fuseau Europe/Paris", () => {
  it("convertit l'heure d'été (UTC+2) et d'hiver (UTC+1)", () => {
    expect(parisVersUtc("2026-07-15T14:30").toISOString()).toBe("2026-07-15T12:30:00.000Z");
    expect(parisVersUtc("2026-12-15T14:30").toISOString()).toBe("2026-12-15T13:30:00.000Z");
  });
  it("gère le changement d'heure (dernier dimanche d'octobre 2026 = 25/10)", () => {
    expect(parisVersUtc("2026-10-25T10:00").toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(parisVersUtc("2026-10-24T10:00").toISOString()).toBe("2026-10-24T08:00:00.000Z");
  });
  it("fait l'aller-retour", () => {
    for (const s of ["2026-03-29T09:15", "2026-10-25T18:45", "2026-01-02T00:00"]) expect(utcVersParis(parisVersUtc(s))).toBe(s);
  });
  it("calcule le lundi de la semaine", () => {
    expect(lundiDe("2026-10-25")).toBe("2026-10-19"); // dimanche
    expect(lundiDe("2026-10-19")).toBe("2026-10-19");
    expect(ajouterJoursStr("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("couleur choisie pour un collaborateur", () => {
  it("prime sur la couleur automatique et est normalisée en minuscules", () => {
    expect(couleurCollaborateur("user-1", "#FF00AA")).toBe("#ff00aa");
  });
  it("retombe sur la couleur automatique si elle est absente ou invalide", () => {
    const auto = couleurCollaborateur("user-1");
    expect(couleurCollaborateur("user-1", null)).toBe(auto);
    expect(couleurCollaborateur("user-1", "")).toBe(auto);
    expect(couleurCollaborateur("user-1", "rouge")).toBe(auto);
    expect(couleurCollaborateur("user-1", "#12345")).toBe(auto);
  });
});

describe("couleur par collaborateur", () => {
  it("est déterministe et issue de la palette de 8 couleurs", () => {
    expect(PALETTE).toHaveLength(8);
    expect(couleurCollaborateur("user-1")).toBe(couleurCollaborateur("user-1"));
    for (const id of ["a", "b", "cmvo0fsct0001rq87tpopvafc", "zzz"]) expect(PALETTE).toContain(couleurCollaborateur(id));
  });
  it("répartit des identifiants différents sur plusieurs couleurs", () => {
    const set = new Set(Array.from({ length: 50 }, (_, i) => couleurCollaborateur(`user-${i}`)));
    expect(set.size).toBeGreaterThan(4);
  });
});
