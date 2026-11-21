import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { stockParametresSchema } from "@/lib/validators/parametres";

/** Paramètres › Stocks & alertes (administrateur) : seuil d'alerte proposé pour une nouvelle pièce. */
export const PUT = route({ permission: ["update", "parametre"], body: stockParametresSchema }, async ({ body }) => {
  await db.parametreGarage.update({ where: { id: 1 }, data: { seuilAlerteDefaut: body.seuilAlerteDefaut } });
  return { ok: true };
});
