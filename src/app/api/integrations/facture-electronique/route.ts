import { z } from "zod";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getFactureProvider } from "@/lib/integrations/facture-electronique";
import { idStr } from "@/lib/validators/common";

/** Consulte le statut d'une facture auprès de la Plateforme Agréée et le trace en base. */
export const GET = route({ permission: ["read", "facture"], query: z.object({ factureId: idStr }) }, async ({ query }) => {
  const f = await db.facture.findUnique({ where: { id: query.factureId }, select: { id: true } });
  if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  const r = await getFactureProvider().recupererStatut(f.id);
  await db.facture.update({ where: { id: f.id }, data: { statutPA: r.statut } });
  return r;
});
