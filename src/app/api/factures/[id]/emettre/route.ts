import { idParam, route } from "@/lib/api";
import { emettreBrouillon } from "@/lib/services/factures";

/** Émission d'un brouillon : numéro légal attribué, stock ajusté, OR passé « Facturé ». */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["create", "facture"] }, async ({ user, params }) => {
  const { id } = idParam.parse(params);
  return emettreBrouillon(id, user.id);
});
