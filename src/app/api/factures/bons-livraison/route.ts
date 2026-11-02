import { z } from "zod";
import { route } from "@/lib/api";
import { creerFactureDepuisBons } from "@/lib/services/factures";
import { idStr } from "@/lib/validators/common";
import { optionsFactureSchema } from "@/lib/validators/facture";

const body = z.object({ bonLivraisonIds: z.array(idStr).min(1, "Sélectionnez au moins un bon de livraison").max(50) }).extend(optionsFactureSchema.shape);

/** « Transformer en facture » : une facture unique pour les bons de livraison cochés. */
export const POST = route({ permission: ["create", "facture"], body }, async ({ body, user }) =>
  creerFactureDepuisBons(body.bonLivraisonIds, user.id, { remise: body.remise, modePaiement: body.modePaiement }),
);
