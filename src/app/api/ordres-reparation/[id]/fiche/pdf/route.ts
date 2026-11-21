import { NextResponse } from "next/server";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pdfFicheControle } from "@/lib/pdf/fiche-controle";
import { accesOrdre } from "@/lib/services/ordres";

/** « Imprimer la fiche » : PDF de la fiche de contrôle (atelier de l'OR, Magasin, administrateur). */
export const GET = route<undefined, undefined, { id: string }>({ permission: ["read", "ordre"] }, async ({ user, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  const r = await pdfFicheControle(id);
  if (!r) throw new ApiError(404, "Fiche introuvable (coordonnées du garage manquantes ?)", "INTROUVABLE");
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="fiche-controle-${r.numero}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
