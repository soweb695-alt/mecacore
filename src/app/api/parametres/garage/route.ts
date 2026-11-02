import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { garageSchema } from "@/lib/validators/parametres";

/** Coordonnées du garage (administrateur) : en-tête et pied de page des devis, factures et bons de livraison. */
export const PATCH = route({ permission: ["update", "parametre"], body: garageSchema }, async ({ body }) => {
  await db.parametreGarage.update({ where: { id: 1 }, data: body });
  return { ok: true };
});
