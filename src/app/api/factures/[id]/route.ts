import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { modifierBrouillon } from "@/lib/services/factures";
import { brouillonSchema, factureModeSchema } from "@/lib/validators/facture";

/** Mode de règlement prévu (« Virement » fait apparaître l'IBAN / BIC sur le PDF). */
export const PATCH = route<z.infer<typeof factureModeSchema>, undefined, { id: string }>({ permission: ["update", "facture"], body: factureModeSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  const f = await db.facture.findUnique({ where: { id }, select: { statut: true } });
  if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  if (f.statut === "ANNULEE") throw new ApiError(409, "Cette facture est annulée", "STATUT_INVALIDE");
  await db.facture.update({ where: { id }, data: { modePaiement: body.modePaiement } });
  return { id };
});

/** Brouillon issu d'un OR : lignes, échéance, remise globale et mode de règlement (avant émission). */
export const PUT = route<z.infer<typeof brouillonSchema>, undefined, { id: string }>({ permission: ["update", "facture"], body: brouillonSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  return modifierBrouillon(id, body);
});
