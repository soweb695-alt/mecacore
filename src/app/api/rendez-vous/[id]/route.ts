import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, idParam, route } from "@/lib/api";
import { enregistrerRdv } from "@/lib/services/rdv";
import { rdvSchema, rdvStatutSchema } from "@/lib/validators/rdv";

/** Déplacement / modification d'un rendez-vous (avec nouveau contrôle de conflit). */
export const PUT = route<z.infer<typeof rdvSchema>, undefined, { id: string }>({ permission: ["update", "rdv"], body: rdvSchema }, async ({ body, params }) =>
  enregistrerRdv(body, idParam.parse(params).id),
);

/** Changement de statut : confirmé, honoré, annulé, absent. */
export const PATCH = route<z.infer<typeof rdvStatutSchema>, undefined, { id: string }>({ permission: ["update", "rdv"], body: rdvStatutSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  const r = await db.rendezVous.updateMany({ where: { id }, data: { statut: body.statut } });
  if (r.count === 0) throw new ApiError(404, "Rendez-vous introuvable", "INTROUVABLE");
  return { id };
});
