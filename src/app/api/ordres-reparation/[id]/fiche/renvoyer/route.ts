import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { renvoyerALAtelier } from "@/lib/services/fiche-controle";

/** Renvoie la fiche à l'atelier pour correction. */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "ordre"] }, async ({ user, params }) => {
  const { id } = idParam.parse(params);
  if (user.role === "MECANICIEN") throw new ApiError(403, "Accès refusé", "INTERDIT");
  return renvoyerALAtelier(id);
});
