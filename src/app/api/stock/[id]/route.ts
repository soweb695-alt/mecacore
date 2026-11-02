import { db } from "@/lib/db";
import { ApiError, idParam, route } from "@/lib/api";
import { pieceSchema } from "@/lib/validators/piece";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import { pieceData, pieceVue } from "@/lib/services/pieces";

export const PATCH = route<ReturnType<typeof pieceSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "piece"], body: pieceSchema },
  async ({ body, user, params }) => {
    const { id } = idParam.parse(params);
    const existe = await db.piece.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ApiError(404, "Pièce introuvable", "INTROUVABLE");
    const p = await db.piece.update({ where: { id }, data: pieceData(body, user, false) });
    await db.$transaction((tx) => verifierReapprovisionnement(tx, [id])); // bon de commande automatique si la pièce passe au seuil
    return pieceVue(p, user);
  },
);

/** Une pièce n'est jamais supprimée physiquement (historique des devis) : elle est désactivée. */
export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["delete", "piece"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.piece.update({ where: { id }, data: { isActive: false } });
  return { id };
});
