import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pointControleSchema } from "@/lib/validators/parametres";

/** Ajoute un point à une catégorie du modèle de la fiche de contrôle (les fiches déjà créées ne changent pas). */
export const POST = route({ permission: ["update", "parametre"], body: pointControleSchema }, async ({ body }) => {
  if (!(await db.categorieControle.count({ where: { id: body.categorieId } }))) throw new ApiError(404, "Catégorie introuvable", "INTROUVABLE");
  const dernier = await db.pointControle.aggregate({ where: { categorieId: body.categorieId }, _max: { position: true } });
  const p = await db.pointControle.create({ data: { libelle: body.libelle, categorieId: body.categorieId, position: (dernier._max.position ?? -1) + 1 } });
  return { id: p.id };
});
