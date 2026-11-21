import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { categorieUpdateSchema } from "@/lib/validators/parametres";

/** Renomme (les pièces de la catégorie suivent) ou déplace une catégorie de pièces. */
export const PATCH = route<z.infer<typeof categorieUpdateSchema>, undefined, { id: string }>({ permission: ["update", "parametre"], body: categorieUpdateSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  const c = await db.categoriePiece.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, "Catégorie introuvable", "INTROUVABLE");
  if (body.deplacer) {
    const liste = await db.categoriePiece.findMany({ orderBy: [{ position: "asc" }, { libelle: "asc" }] });
    const i = liste.findIndex((x) => x.id === id);
    const j = body.deplacer === "haut" ? i - 1 : i + 1;
    if (j >= 0 && j < liste.length) {
      const [a] = liste.splice(i, 1);
      liste.splice(j, 0, a);
      await db.$transaction(liste.map((x, pos) => db.categoriePiece.update({ where: { id: x.id }, data: { position: pos } })));
    }
  }
  if (body.libelle !== undefined && body.libelle !== c.libelle) {
    const doublon = await db.categoriePiece.findFirst({ where: { id: { not: id }, libelle: { equals: body.libelle, mode: "insensitive" } } });
    if (doublon) throw new ApiError(409, "Cette catégorie existe déjà", "DOUBLON");
    await db.$transaction([
      db.categoriePiece.update({ where: { id }, data: { libelle: body.libelle } }),
      db.piece.updateMany({ where: { categorie: c.libelle }, data: { categorie: body.libelle } }),
    ]);
  }
  return { id };
});

/** Supprime une catégorie de la liste ; les pièces qui la portent la gardent. */
export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["update", "parametre"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.categoriePiece.deleteMany({ where: { id } });
  return { id };
});
