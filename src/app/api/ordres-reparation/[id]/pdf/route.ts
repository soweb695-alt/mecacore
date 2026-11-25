import { NextResponse } from "next/server";
import { z } from "zod";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pdfOrdre } from "@/lib/pdf/ordre";
import { accesOrdre } from "@/lib/services/ordres";

const query = z.object({ prix: z.enum(["0", "1"]).optional() });

/** PDF de l'ordre de réparation (« Bon pour accord » signé). L'atelier n'obtient jamais la version avec prix. */
export const GET = route<undefined, z.infer<typeof query>, { id: string }>({ permission: ["read", "ordre"], query }, async ({ user, params, query }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  const r = await pdfOrdre(id, { prix: query.prix === "1" && user.role !== "MECANICIEN" });
  if (!r) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
  return new NextResponse(Buffer.from(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.numero}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
