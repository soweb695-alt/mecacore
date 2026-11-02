import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { pieceVersCsv, pieceVersXlsx, tableauPieces } from "@/lib/export-pieces";
import { ImportError, analyserCsv, analyserLignes, decoderTexte, lireFichierImport, lireNombre, modeleImport } from "@/lib/import-pieces";

const enc = (s: string) => new TextEncoder().encode(s);

describe("lecture CSV", () => {
  it("détecte le séparateur, gère guillemets, retours à la ligne et BOM", () => {
    const rows = analyserCsv('﻿Référence;Désignation;Prix vente HT\r\nA1;"Filtre ""pro""; huile";12,5\r\nA2;"Ligne\nsur deux";3\r\n');
    expect(rows[0]).toEqual(["﻿Référence", "Désignation", "Prix vente HT"]);
    expect(rows[1]).toEqual(["A1", 'Filtre "pro"; huile', "12,5"]);
    expect(rows[2][1]).toBe("Ligne\nsur deux");
    expect(analyserCsv("a,b\n1,2")[1]).toEqual(["1", "2"]);
    expect(analyserCsv("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
  });

  it("décode l'UTF-8 et, à défaut, le Windows-1252 des « CSV » d'Excel français", () => {
    expect(decoderTexte(enc("é"))).toBe("é");
    expect(decoderTexte(new Uint8Array([0x52, 0xe9, 0x66]))).toBe("Réf"); // 0xE9 seul : invalide en UTF-8
  });

  it("lit les nombres français", () => {
    expect(lireNombre("12,50")).toBe(12.5);
    expect(lireNombre("1 234,50 €")).toBe(1234.5);
    expect(lireNombre("7.25")).toBe(7.25);
    expect(lireNombre("abc")).toBeNull();
    expect(lireNombre("")).toBeNull();
  });
});

describe("validation des lignes", () => {
  const entete = ["Référence", "Désignation", "Marque", "Prix achat HT", "Prix vente HT", "Stock", "Seuil d'alerte", "Taille de pneu", "Références croisées"];

  it("reconnaît les titres de colonnes (accents, majuscules, synonymes)", () => {
    const r = analyserLignes([["REF", "designation", "Prix d'achat", "Quantité"], ["a1", "Filtre", "4,1", "3"]]);
    expect(r.lignes[0].valeurs).toEqual({ reference: "A1", nom: "Filtre", prixAchatHT: 4.1, stock: 3 });
  });

  it("transforme une ligne complète", () => {
    const { lignes } = analyserLignes([entete, ["bsh-1", "Plaquettes", "Bosch", "28,40", "49,90", "10", "5", "205/55 r16", "TRW 1 | ate 2, trw 1"]]);
    expect(lignes[0].erreurs).toEqual([]);
    expect(lignes[0].valeurs).toEqual({
      reference: "BSH-1", nom: "Plaquettes", marque: "Bosch", prixAchatHT: 28.4, prixVenteHT: 49.9, stock: 10, seuilAlerte: 5, taillePneu: "205/55 R16", referencesCroisees: ["TRW 1", "ATE 2"],
    });
  });

  it("signale chaque erreur avec son numéro de ligne, sans arrêter l'analyse", () => {
    const { lignes } = analyserLignes([
      entete,
      ["", "Sans réf", "", "", "10", "", "", "", ""],
      ["A1", "Prix négatif", "", "", "-5", "", "", "", ""],
      ["A2", "Stock décimal", "", "", "5", "1,5", "", "", ""],
      ["A3", "Pneu", "", "", "5", "", "", "grosse roue", ""],
      ["A4", "Texte", "", "", "cinq", "", "", "", ""],
      ["A5", "OK", "", "", "5", "", "", "", ""],
      ["a5", "Doublon", "", "", "5", "", "", "", ""],
    ]);
    expect(lignes.map((l) => l.erreurs.length > 0)).toEqual([true, true, true, true, true, false, true]);
    expect(lignes[0].ligne).toBe(2);
    expect(lignes[6].erreurs[0]).toMatch(/double.*ligne 7|déjà ligne 7/);
    expect(lignes[1].erreurs[0]).toMatch(/Prix vente HT/);
  });

  it("refuse un fichier sans colonne Référence ou sans donnée, ou trop gros", () => {
    expect(analyserLignes([["Nom", "Prix"], ["x", "1"]]).erreurFichier).toMatch(/Référence/);
    expect(analyserLignes([["Référence"]]).erreurFichier).toMatch(/aucune ligne/);
    const trop = [["Référence"], ...Array.from({ length: 2001 }, (_, i) => [`R${i}`])];
    expect(analyserLignes(trop).erreurFichier).toMatch(/2000/);
  });

  it("ignore les lignes entièrement vides", () => {
    expect(analyserLignes([["Référence"], ["A"], ["", ""], ["B"]]).lignes).toHaveLength(2);
  });
});

describe("fichiers .xlsx et .csv", () => {
  it("relit un classeur Excel et un export (aller-retour)", async () => {
    const pieces = [
      { reference: "A1", nom: "Filtre", marque: "Mann", fournisseur: "Autodis", categorie: "Filtration", prixAchatHT: 4.1, prixVenteHT: 9.9, stock: 3, seuilAlerte: 2, taillePneu: null, referencesCroisees: ["X1", "X2"] },
    ];
    const t = tableauPieces(pieces, true);
    const xlsx = await pieceVersXlsx(t);
    const rows = await lireFichierImport("pieces.xlsx", new Uint8Array(xlsx));
    const { lignes } = analyserLignes(rows);
    expect(lignes[0].erreurs).toEqual([]);
    expect(lignes[0].valeurs).toMatchObject({ reference: "A1", nom: "Filtre", prixAchatHT: 4.1, prixVenteHT: 9.9, stock: 3, referencesCroisees: ["X1", "X2"] });

    const csvRows = await lireFichierImport("pieces.csv", enc(pieceVersCsv(t)));
    expect(analyserLignes(csvRows).lignes[0].valeurs).toEqual(lignes[0].valeurs);
  });

  it("n'expose pas le prix d'achat dans l'export d'un rôle qui ne le voit pas", () => {
    const t = tableauPieces([{ reference: "A", nom: "n", marque: null, fournisseur: null, categorie: null, prixVenteHT: 1, stock: 0, seuilAlerte: 0, taillePneu: null, referencesCroisees: [] }], false);
    expect(t.entetes).not.toContain("Prix achat HT");
    expect(modeleImport(false).entetes).not.toContain("Prix achat HT");
    expect(modeleImport(true).entetes).toContain("Prix achat HT");
  });

  it("lit les formules par leur résultat et rejette les fichiers invalides", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("T");
    ws.addRow(["Référence", "Désignation", "Prix vente HT"]);
    ws.addRow(["A1", "Pièce", { formula: "5*2", result: 10 }]);
    const buf = new Uint8Array(await wb.xlsx.writeBuffer());
    expect(analyserLignes(await lireFichierImport("f.xlsx", buf)).lignes[0].valeurs?.prixVenteHT).toBe(10);

    await expect(lireFichierImport("f.xlsx", enc("pas un zip"))).rejects.toBeInstanceOf(ImportError);
    await expect(lireFichierImport("f.pdf", enc("x"))).rejects.toThrow(/Format non pris en charge/);
    await expect(lireFichierImport("f.csv", new Uint8Array())).rejects.toThrow(/vide/);
    await expect(lireFichierImport("f.csv", new Uint8Array(2_000_001))).rejects.toThrow(/volumineux/);
  });
});
