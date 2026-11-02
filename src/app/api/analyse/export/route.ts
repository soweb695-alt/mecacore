import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { versCsv } from "@/lib/csv";
import { dateFR } from "@/lib/format";
import { analyser } from "@/lib/services/analyse";

const query = z.object({
  type: z.enum(["factures", "pieces", "collaborateurs"]),
  periode: z.enum(["mois", "trimestre", "annee"]).default("mois"),
});

// Données de marge : réservé à l'admin (permission « export » sur « analyse »).
export const GET = route({ permission: ["export", "analyse"], query }, async ({ query: q }) => {
  const a = await analyser(q.periode);
  let csv: string;
  if (q.type === "factures") csv = versCsv(["Numéro", "Date", "Total HT", "Total TTC", "Statut"], a.factures.map((f) => [f.numero, dateFR(f.date), f.totalHT, f.totalTTC, f.statut]));
  else if (q.type === "pieces") csv = versCsv(["Référence", "Désignation", "Quantité", "CA HT", "Marge"], a.topPieces.map((p) => [p.reference, p.nom, p.qte, p.ca, p.marge]));
  else csv = versCsv(["Collaborateur", "CA HT"], a.parCollaborateur.map((c) => [c.nom, c.ca]));
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="analyse-${q.type}-${q.periode}.csv"`, "Cache-Control": "private, no-store" },
  });
});
