import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { categorieControleSchema } from "@/lib/validators/parametres";

/** Ajoute une catégorie au modèle de la fiche de contrôle (Paramètres › Fiche de contrôle). */
export const POST = route({ permission: ["update", "parametre"], body: categorieControleSchema }, async ({ body }) => {
  const dernier = await db.categorieControle.aggregate({ _max: { position: true } });
  const c = await db.categorieControle.create({ data: { libelle: body.libelle, typeStatuts: body.typeStatuts, position: (dernier._max.position ?? -1) + 1 } });
  return { id: c.id };
});
