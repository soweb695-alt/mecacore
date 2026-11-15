import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { modelesEmailSchema } from "@/lib/validators/parametres";

/** Modèles d'e-mails « Véhicule prêt » et « Rappel de rendez-vous » (administrateur). Champ vide : texte par défaut. */
export const PUT = route({ permission: ["update", "parametre"], body: modelesEmailSchema }, async ({ body }) => {
  const vide = (s: string) => (s.trim() === "" ? null : s);
  await db.parametreGarage.update({
    where: { id: 1 },
    data: {
      emailVehiculePretSujet: vide(body.vehiculePret.sujet),
      emailVehiculePretCorps: vide(body.vehiculePret.corps),
      emailRappelRdvSujet: vide(body.rappelRdv.sujet),
      emailRappelRdvCorps: vide(body.rappelRdv.corps),
    },
  });
  return { ok: true };
});
