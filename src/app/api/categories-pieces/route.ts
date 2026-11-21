import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { categorieSchema } from "@/lib/validators/parametres";

/** Ajoute une catégorie de pièces (proposée dans la fiche pièce et le filtre du Stock). */
export const POST = route({ permission: ["update", "parametre"], body: categorieSchema }, async ({ body }) => {
  const existe = await db.categoriePiece.findFirst({ where: { libelle: { equals: body.libelle, mode: "insensitive" } } });
  if (existe) throw new ApiError(409, "Cette catégorie existe déjà", "DOUBLON");
  const dernier = await db.categoriePiece.aggregate({ _max: { position: true } });
  const c = await db.categoriePiece.create({ data: { libelle: body.libelle, position: (dernier._max.position ?? -1) + 1 } });
  return { id: c.id };
});
