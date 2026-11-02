import ExcelJS from "exceljs";
import { APP_NAME } from "@/lib/app";
import { versCsv } from "@/lib/csv";

export interface PieceExport {
  reference: string;
  nom: string;
  marque: string | null;
  fournisseur: string | null;
  categorie: string | null;
  prixAchatHT?: number;
  prixVenteHT: number;
  stock: number;
  seuilAlerte: number;
  taillePneu: string | null;
  referencesCroisees: string[];
}

/** Colonnes dans l'ordre attendu à l'import : un fichier exporté peut être réimporté tel quel. */
export function tableauPieces(pieces: PieceExport[], avecAchat: boolean): { entetes: string[]; lignes: (string | number)[][] } {
  const entetes = ["Référence", "Désignation", "Marque", "Fournisseur", "Catégorie", ...(avecAchat ? ["Prix achat HT"] : []), "Prix vente HT", "Stock", "Seuil d'alerte", "Taille de pneu", "Références croisées"];
  const lignes = pieces.map((p) => [
    p.reference, p.nom, p.marque ?? "", p.fournisseur ?? "", p.categorie ?? "",
    ...(avecAchat ? [p.prixAchatHT ?? 0] : []),
    p.prixVenteHT, p.stock, p.seuilAlerte, p.taillePneu ?? "", p.referencesCroisees.join(", "),
  ]);
  return { entetes, lignes };
}

export function pieceVersCsv(t: { entetes: string[]; lignes: (string | number)[][] }): string {
  return versCsv(t.entetes, t.lignes);
}

export async function pieceVersXlsx(t: { entetes: string[]; lignes: (string | number)[][] }, titre = "Pièces"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  const ws = wb.addWorksheet(titre);
  ws.addRow(t.entetes).font = { bold: true };
  for (const l of t.lignes) ws.addRow(l);
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((c, i) => {
    const largeur = Math.max(t.entetes[i].length, ...t.lignes.slice(0, 200).map((l) => String(l[i] ?? "").length));
    c.width = Math.min(50, largeur + 2);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
