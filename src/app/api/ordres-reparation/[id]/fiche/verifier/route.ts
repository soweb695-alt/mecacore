import { z } from "zod";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { verifierFiche } from "@/lib/services/fiche-controle";
import { ficheVerificationSchema } from "@/lib/validators/parametres";

/** « Vérification du responsable » : nom et signature du Magasin ou de l'administrateur sur une fiche transmise. */
export const POST = route<z.infer<typeof ficheVerificationSchema>, undefined, { id: string }>({ permission: ["update", "ordre"], body: ficheVerificationSchema }, async ({ user, body, params }) => {
  const { id } = idParam.parse(params);
  if (user.role === "MECANICIEN") throw new ApiError(403, "La vérification est faite par le Magasin ou l'administrateur", "INTERDIT");
  return verifierFiche(id, user, body);
});
