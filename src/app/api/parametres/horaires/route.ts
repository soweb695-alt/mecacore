import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { horairesSchema } from "@/lib/validators/parametres";

/** Horaires d'ouverture du garage (administrateur). */
export const PUT = route({ permission: ["update", "parametre"], body: horairesSchema }, async ({ body }) => {
  await db.parametreGarage.update({ where: { id: 1 }, data: { horaires: body } });
  return { ok: true };
});
