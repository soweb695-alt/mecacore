import { idParam, route } from "@/lib/api";
import { modifierRetour, supprimerRetour } from "@/lib/services/retours";
import { retourSchema } from "@/lib/validators/retour";

export const PATCH = route<ReturnType<typeof retourSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "retour"], body: retourSchema },
  async ({ body, params }) => modifierRetour(idParam.parse(params).id, body),
);

/** Suppression réservée à l'administrateur (saisie erronée). */
export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["delete", "retour"] }, async ({ params }) => supprimerRetour(idParam.parse(params).id));
