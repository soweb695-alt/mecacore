import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { communicationSchema } from "@/lib/validators/parametres";

const vide = (s: string) => (s.trim() === "" ? null : s);

/** Paramètres › Communication (administrateur) : expéditeur des e-mails et modèles « Véhicule prêt » / « Rappel RDV ». */
export const PUT = route({ permission: ["update", "parametre"], body: communicationSchema }, async ({ body }) => {
  await db.parametreGarage.update({
    where: { id: 1 },
    data: {
      expediteurNom: vide(body.expediteurNom),
      expediteurEmail: vide(body.expediteurEmail),
      emailVehiculePretSujet: vide(body.vehiculePret.sujet),
      emailVehiculePretCorps: vide(body.vehiculePret.corps),
      emailRappelRdvSujet: vide(body.rappelRdv.sujet),
      emailRappelRdvCorps: vide(body.rappelRdv.corps),
    },
  });
  return { ok: true };
});
