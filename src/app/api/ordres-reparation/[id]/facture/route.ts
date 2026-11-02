import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { creerBrouillonTx } from "@/lib/services/factures";

/** Prépare la facture brouillon d'un OR à traiter qui n'en a pas (OR terminé avant la préparation automatique). */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["create", "facture"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  return db.$transaction(async (tx) => {
    const o = await tx.ordreReparation.findUnique({ where: { id }, select: { statut: true } });
    if (!o) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
    if (o.statut !== "A_TRAITER_MAGASIN") throw new ApiError(409, "Cet ordre n'est pas à traiter par le Magasin", "STATUT_INVALIDE");
    return creerBrouillonTx(tx, id);
  });
});
