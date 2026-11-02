import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { pointControleSchema } from "@/lib/validators/parametres";

/** Ajoute un point au modèle de la fiche de contrôle (les fiches déjà créées ne changent pas). */
export const POST = route({ permission: ["update", "parametre"], body: pointControleSchema }, async ({ body }) => {
  const dernier = await db.pointControle.aggregate({ _max: { position: true } });
  const p = await db.pointControle.create({ data: { libelle: body.libelle, position: (dernier._max.position ?? -1) + 1 } });
  return { id: p.id };
});
