// Lecture et validation d'un fichier d'import de pièces (CSV ou Excel). Module sans accès base de données.
import ExcelJS from "exceljs";

export const COLONNES_IMPORT = [
  { cle: "reference", titre: "Référence", obligatoire: true, aide: "Identifiant unique de la pièce. Une référence déjà présente met la pièce à jour." },
  { cle: "nom", titre: "Désignation", obligatoire: true, aide: "Nom de la pièce (obligatoire pour une nouvelle pièce)." },
  { cle: "marque", titre: "Marque", obligatoire: false, aide: "" },
  { cle: "fournisseur", titre: "Fournisseur", obligatoire: false, aide: "" },
  { cle: "categorie", titre: "Catégorie", obligatoire: false, aide: "" },
  { cle: "prixAchatHT", titre: "Prix achat HT", obligatoire: false, aide: "En euros. Ignoré pour les rôles qui ne voient pas les prix d'achat." },
  { cle: "prixVenteHT", titre: "Prix vente HT", obligatoire: true, aide: "En euros (obligatoire pour une nouvelle pièce)." },
  { cle: "stock", titre: "Stock", obligatoire: false, aide: "Nombre entier. Pour une pièce existante, la quantité est AJOUTÉE au stock actuel." },
  { cle: "seuilAlerte", titre: "Seuil d'alerte", obligatoire: false, aide: "Nombre entier." },
  { cle: "taillePneu", titre: "Taille de pneu", obligatoire: false, aide: "Format 205/55 R16." },
  { cle: "referencesCroisees", titre: "Références croisées", obligatoire: false, aide: "Séparées par des virgules ou des barres verticales." },
] as const;

export type CleColonne = (typeof COLONNES_IMPORT)[number]["cle"];

export const MAX_LIGNES_IMPORT = 2000;
export const MAX_TAILLE_IMPORT = 2_000_000;

export interface PieceImport {
  reference: string;
  nom?: string;
  marque?: string;
  fournisseur?: string;
  categorie?: string;
  prixAchatHT?: number;
  prixVenteHT?: number;
  stock?: number;
  seuilAlerte?: number;
  taillePneu?: string;
  referencesCroisees?: string[];
}

export interface LigneAnalysee {
  ligne: number;
  valeurs?: PieceImport;
  erreurs: string[];
}

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SYNONYMES: Record<string, CleColonne> = {
  reference: "reference", ref: "reference", referencepiece: "reference",
  nom: "nom", designation: "nom", libelle: "nom", description: "nom",
  marque: "marque",
  fournisseur: "fournisseur",
  categorie: "categorie", famille: "categorie",
  prixachatht: "prixAchatHT", prixachat: "prixAchatHT", prixdachatht: "prixAchatHT", prixdachat: "prixAchatHT", achatht: "prixAchatHT",
  prixventeht: "prixVenteHT", prixvente: "prixVenteHT", ventht: "prixVenteHT",
  stock: "stock", quantite: "stock", qte: "stock",
  seuilalerte: "seuilAlerte", seuildalerte: "seuilAlerte", seuil: "seuilAlerte",
  taillepneu: "taillePneu", tailledepneu: "taillePneu", pneu: "taillePneu", dimension: "taillePneu",
  referencescroisees: "referencesCroisees", referencecroisee: "referencesCroisees", croisees: "referencesCroisees",
};

/** Décode un CSV en UTF-8, ou en Windows-1252 (export « CSV » d'Excel français) si l'UTF-8 est invalide. */
export function decoderTexte(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Analyse CSV (séparateur « ; », « , » ou tabulation détecté ; guillemets et retours à la ligne gérés). */
export function analyserCsv(texte: string): string[][] {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((c) => [c, premiere.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let ligne: string[] = [];
  let cell = "";
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cell += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      ligne.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(cell);
      cell = "";
      rows.push(ligne);
      ligne = [];
    } else cell += c;
  }
  if (cell !== "" || ligne.length > 0) {
    ligne.push(cell);
    rows.push(ligne);
  }
  return rows;
}

async function lireXlsx(buf: Uint8Array): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cellules: string[] = [];
    const n = Math.max(row.cellCount, row.actualCellCount);
    for (let c = 1; c <= n; c++) {
      const v = row.getCell(c).value;
      if (v === null || v === undefined) cellules.push("");
      else if (typeof v === "object" && "result" in v) cellules.push(String((v as { result?: unknown }).result ?? ""));
      else if (typeof v === "object" && "text" in v) cellules.push(String((v as { text?: unknown }).text ?? ""));
      else if (typeof v === "object" && "richText" in v) cellules.push((v as { richText: { text: string }[] }).richText.map((t) => t.text).join(""));
      else cellules.push(String(v));
    }
    rows.push(cellules);
  });
  return rows;
}

export class ImportError extends Error {}

/** Lit un fichier .csv ou .xlsx et renvoie les lignes brutes (la première est l'en-tête). */
export async function lireFichierImport(nom: string, buf: Uint8Array): Promise<string[][]> {
  if (buf.byteLength === 0) throw new ImportError("Le fichier est vide.");
  if (buf.byteLength > MAX_TAILLE_IMPORT) throw new ImportError("Fichier trop volumineux (2 Mo maximum).");
  const ext = nom.toLowerCase().split(".").pop();
  if (ext === "xlsx") {
    // Un .xlsx est une archive ZIP : on contrôle la signature avant de la confier au lecteur.
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) throw new ImportError("Ce fichier n'est pas un classeur Excel (.xlsx) valide.");
    try {
      return await lireXlsx(buf);
    } catch {
      throw new ImportError("Impossible de lire ce classeur Excel : fichier abîmé ou protégé.");
    }
  }
  if (ext === "csv" || ext === "txt") return analyserCsv(decoderTexte(buf));
  throw new ImportError("Format non pris en charge : utilisez un fichier .xlsx ou .csv.");
}

/** Convertit « 1 234,50 € » ou « 12.5 » en nombre ; null si la cellule n'est pas un nombre. */
export function lireNombre(brut: string): number | null {
  const t = brut.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Valide chaque ligne (hors en-tête) et la transforme en pièce à créer ou mettre à jour. */
export function analyserLignes(rows: string[][]): { lignes: LigneAnalysee[]; erreurFichier?: string } {
  if (rows.length < 2) return { lignes: [], erreurFichier: "Le fichier ne contient aucune ligne de données (seule la ligne d'en-tête est attendue en première ligne)." };
  const entetes = rows[0].map((h) => SYNONYMES[normaliser(h)]);
  if (!entetes.includes("reference")) {
    return { lignes: [], erreurFichier: "Colonne « Référence » introuvable. Vérifiez la première ligne du fichier (voir le format attendu)." };
  }
  if (rows.length - 1 > MAX_LIGNES_IMPORT) return { lignes: [], erreurFichier: `Trop de lignes : ${MAX_LIGNES_IMPORT} maximum par import.` };

  const vues = new Map<string, number>();
  const lignes: LigneAnalysee[] = [];
  for (let i = 1; i < rows.length; i++) {
    const brut = rows[i];
    if (brut.every((c) => c.trim() === "")) continue;
    const erreurs: string[] = [];
    const v: Partial<Record<CleColonne, string>> = {};
    entetes.forEach((cle, idx) => {
      if (cle && (brut[idx] ?? "").trim() !== "") v[cle] = brut[idx].trim();
    });

    const reference = (v.reference ?? "").toUpperCase();
    if (!reference) erreurs.push("Référence manquante.");
    else if (reference.length > 60) erreurs.push("Référence trop longue (60 caractères maximum).");
    else if (vues.has(reference)) erreurs.push(`Référence en double dans le fichier (déjà ligne ${vues.get(reference)}).`);
    else vues.set(reference, i + 1);

    const pieces: PieceImport = { reference };
    const texte = (cle: "nom" | "marque" | "fournisseur" | "categorie", max: number) => {
      const t = v[cle];
      if (t === undefined) return;
      if (t.length > max) erreurs.push(`« ${COLONNES_IMPORT.find((c) => c.cle === cle)!.titre} » trop long (${max} caractères maximum).`);
      else pieces[cle] = t;
    };
    texte("nom", 150);
    texte("marque", 60);
    texte("fournisseur", 80);
    texte("categorie", 60);

    for (const cle of ["prixAchatHT", "prixVenteHT"] as const) {
      if (v[cle] === undefined) continue;
      const n = lireNombre(v[cle]!);
      const titre = COLONNES_IMPORT.find((c) => c.cle === cle)!.titre;
      if (n === null) erreurs.push(`« ${titre} » : « ${v[cle]} » n'est pas un nombre.`);
      else if (n < 0 || n > 100000) erreurs.push(`« ${titre} » doit être compris entre 0 et 100 000.`);
      else pieces[cle] = Math.round(n * 100) / 100;
    }
    for (const cle of ["stock", "seuilAlerte"] as const) {
      if (v[cle] === undefined) continue;
      const n = lireNombre(v[cle]!);
      const titre = COLONNES_IMPORT.find((c) => c.cle === cle)!.titre;
      if (n === null || !Number.isInteger(n)) erreurs.push(`« ${titre} » : « ${v[cle]} » n'est pas un nombre entier.`);
      else if (n < 0 || n > 100000) erreurs.push(`« ${titre} » doit être compris entre 0 et 100 000.`);
      else pieces[cle] = n;
    }
    if (v.taillePneu !== undefined) {
      const t = v.taillePneu.toUpperCase();
      if (!/^\d{3}\/\d{2} ?Z?R ?\d{2}$/.test(t)) erreurs.push("« Taille de pneu » : format attendu 205/55 R16.");
      else pieces.taillePneu = t;
    }
    if (v.referencesCroisees !== undefined) {
      const refs = v.referencesCroisees.split(/[,|;]/).map((r) => r.trim().toUpperCase()).filter(Boolean);
      if (refs.length > 30 || refs.some((r) => r.length > 60)) erreurs.push("« Références croisées » : 30 références de 60 caractères maximum.");
      else pieces.referencesCroisees = [...new Set(refs)];
    }
    lignes.push({ ligne: i + 1, valeurs: erreurs.length ? undefined : pieces, erreurs });
  }
  if (lignes.length === 0) return { lignes, erreurFichier: "Le fichier ne contient aucune ligne de données." };
  return { lignes };
}

/** Fichier modèle : la ligne d'en-tête attendue et un exemple. */
export function modeleImport(avecAchat: boolean): { entetes: string[]; exemple: (string | number)[] } {
  const cols = COLONNES_IMPORT.filter((c) => avecAchat || c.cle !== "prixAchatHT");
  const exemples: Record<string, string | number> = {
    reference: "BSH-0986494", nom: "Plaquettes avant Bosch", marque: "Bosch", fournisseur: "Autodis", categorie: "Freinage",
    prixAchatHT: 28.4, prixVenteHT: 49.9, stock: 10, seuilAlerte: 5, taillePneu: "", referencesCroisees: "TRW GDB1550, ATE 13.0460",
  };
  return { entetes: cols.map((c) => c.titre), exemple: cols.map((c) => exemples[c.cle]) };
}
