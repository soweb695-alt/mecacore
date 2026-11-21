import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { categorieControleUpdateSchema } from "@/lib/validators/parametres";

/** Renomme, change le type de statuts, active / désactive ou déplace une catégorie (les fiches déjà créées ne changent pas). */
export const PATCH = route<z.infer<typeof categorieControleUpdateSchema>, undefined, { id: string }>({ permission: ["update", "parametre"], body: categorieControleUpdateSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  const c = await db.categorieControle.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, "Catégorie introuvable", "INTROUVABLE");
  if (body.deplacer) {
    const liste = await db.categorieControle.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    const i = liste.findIndex((x) => x.id === id);
    const j = body.deplacer === "haut" ? i - 1 : i + 1;
    if (j >= 0 && j < liste.length) {
      const [a] = liste.splice(i, 1);
      liste.splice(j, 0, a);
      await db.$transaction(liste.map((x, pos) => db.categorieControle.update({ where: { id: x.id }, data: { position: pos } })));
    }
  }
  const data = {
    ...(body.libelle !== undefined ? { libelle: body.libelle } : {}),
    ...(body.typeStatuts !== undefined ? { typeStatuts: body.typeStatuts } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
  };
  if (Object.keys(data).length) await db.categorieControle.update({ where: { id }, data });
  return { id };
});

/** Supprime une catégorie et ses points du modèle (les fiches déjà créées gardent leur copie). */
export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["update", "parametre"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.categorieControle.deleteMany({ where: { id } });
  return { id };
});
