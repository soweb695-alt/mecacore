import { z } from "zod";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { accesOrdre } from "@/lib/services/ordres";
import { enregistrerFiche } from "@/lib/services/fiche-controle";
import { ficheSaisieSchema } from "@/lib/validators/parametres";

/** Saisie ou validation de la fiche de contrôle par le technicien de l'OR (ou l'administrateur). */
export const PUT = route<z.infer<typeof ficheSaisieSchema>, undefined, { id: string }>({ permission: ["update", "ordre"], body: ficheSaisieSchema }, async ({ user, body, params }) => {
  const { id } = idParam.parse(params);
  if (user.role === "SECRETARIAT") throw new ApiError(403, "La fiche est remplie par l'atelier", "INTERDIT");
  await accesOrdre(user, id);
  return enregistrerFiche(id, user, body);
});
