import { describe, expect, it } from "vitest";
import { filtrerSuggestions } from "@/components/ui/autocomplete-input";

const CATEGORIES = ["Filtration", "Freinage", "Pneus", "Batterie", "Direction", "Éclairage"];

describe("propositions de catégorie au fil de la frappe", () => {
  it("propose ce qui commence par la saisie, sans tenir compte des majuscules ni des accents", () => {
    expect(filtrerSuggestions(CATEGORIES, "frei")).toEqual(["Freinage"]);
    expect(filtrerSuggestions(CATEGORIES, "FREI")).toEqual(["Freinage"]);
    expect(filtrerSuggestions(CATEGORIES, "ecl")).toEqual(["Éclairage"]);
    expect(filtrerSuggestions(CATEGORIES, "f")).toEqual(["Filtration", "Freinage"]);
  });
  it("puis ce qui contient la saisie ; tout (dans l'ordre) quand le champ est vide", () => {
    expect(filtrerSuggestions(CATEGORIES, "ti")).toEqual(["Filtration", "Direction"]);
    expect(filtrerSuggestions(CATEGORIES, "ra")).toEqual(["Filtration", "Éclairage"]);
    expect(filtrerSuggestions(CATEGORIES, "")).toEqual(CATEGORIES);
    expect(filtrerSuggestions(CATEGORIES, "xyz")).toEqual([]);
  });
});
