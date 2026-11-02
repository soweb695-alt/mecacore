import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { banqueSchema } from "@/lib/validators/parametres";

/** Coordonnées bancaires du garage (administrateur) : affichées sur le PDF des factures réglées par virement. */
export const PATCH = route({ permission: ["update", "parametre"], body: banqueSchema }, async ({ body }) => {
  await db.parametreGarage.update({ where: { id: 1 }, data: { iban: body.iban || null, bic: body.bic || null } });
  return { ok: true };
});
