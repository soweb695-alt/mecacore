import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { pieceVersCsv, pieceVersXlsx, tableauPieces, type PieceExport } from "@/lib/export-pieces";
import { modeleImport } from "@/lib/import-pieces";
import { canSeePurchasePrice } from "@/lib/permissions";
import { versCsv } from "@/lib/csv";
import { rechercherPieces } from "@/lib/services/pieces";

const query = z.object({
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
  q: z.string().trim().max(100).optional(),
  categorie: z.string().trim().max(60).optional(),
  bas: z.enum(["1"]).optional(),
  modele: z.enum(["1"]).optional(),
});

const TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/** Export de la liste des pièces (filtres de la page Stock respectés) ou du fichier modèle d'import. */
export const GET = route({ permission: ["export", "piece"], query }, async ({ query: q, user }) => {
  const achat = canSeePurchasePrice(user);
  let corps: Buffer | string;
  let nom: string;
  if (q.modele) {
    const m = modeleImport(achat);
    corps = q.format === "csv" ? versCsv(m.entetes, [m.exemple]) : await pieceVersXlsx({ entetes: m.entetes, lignes: [m.exemple] }, "Modèle");
    nom = "modele-import-pieces";
  } else {
    // Toutes les pages du résultat filtré (plafonné à 20 000 pièces).
    const pieces: PieceExport[] = [];
    for (let page = 1; page <= 800; page++) {
      const r = await rechercherPieces(user, { q: q.q, categorie: q.categorie, bas: q.bas === "1", page });
      pieces.push(...r.items.map((p) => ({ ...p, prixAchatHT: p.prixAchatHT })));
      if (page >= r.pages) break;
    }
    const t = tableauPieces(pieces, achat);
    corps = q.format === "csv" ? pieceVersCsv(t) : await pieceVersXlsx(t);
    nom = `pieces-${new Date().toISOString().slice(0, 10)}`;
  }
  return new NextResponse(typeof corps === "string" ? corps : new Uint8Array(corps), {
    headers: { "Content-Type": TYPES[q.format], "Content-Disposition": `attachment; filename="${nom}.${q.format}"`, "Cache-Control": "private, no-store" },
  });
});
