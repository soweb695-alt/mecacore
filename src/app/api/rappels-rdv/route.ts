import { z } from "zod";
import { route } from "@/lib/api";
import { idStr } from "@/lib/validators/common";
import { envoyerRappelValide } from "@/lib/services/rappels";

const corps = z.object({ rappels: z.array(z.object({ rdvId: idStr, campagneId: idStr })).min(1).max(100) });

/**
 * Envoi des rappels de rendez-vous validés depuis le tableau de bord (un ou plusieurs).
 * Chaque rappel est traité séparément : un échec n'empêche pas les autres.
 */
export const POST = route({ permission: ["create", "message"], body: corps }, async ({ body }) => {
  const resultats = [];
  for (const r of body.rappels) {
    try {
      resultats.push({ ...r, resultat: await envoyerRappelValide(r.rdvId, r.campagneId) });
    } catch (e) {
      resultats.push({ ...r, resultat: "erreur" as const, message: e instanceof Error ? e.message : "Erreur" });
    }
  }
  return { resultats };
});
