import { lireFormulaire } from "@/lib/body";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { accesOrdre, ajouterPhoto } from "@/lib/services/ordres";

// Le corps est multipart : on ne passe pas par le parseur JSON de `route`.
export const POST = route<undefined, undefined, { id: string }>({ permission: ["create", "photo"] }, async ({ req, user, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  const form = await lireFormulaire(req, 6_000_000, "Photo trop volumineuse (5 Mo maximum)");
  const fichier = form?.get("photo");
  if (!(fichier instanceof File)) throw new ApiError(400, "Aucune photo reçue", "FICHIER_MANQUANT");
  const nb = await db.photoOR.count({ where: { ordreId: id } });
  if (nb >= 30) throw new ApiError(409, "Nombre maximal de photos atteint", "LIMITE");
  return ajouterPhoto(id, user.id, fichier);
});
