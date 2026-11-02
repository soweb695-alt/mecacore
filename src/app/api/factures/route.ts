import { route } from "@/lib/api";
import { creerFactureDepuisDevis } from "@/lib/services/factures";
import { factureDepuisDevisAvecOptionsSchema } from "@/lib/validators/facture";

export const POST = route({ permission: ["create", "facture"], body: factureDepuisDevisAvecOptionsSchema }, async ({ body, user }) =>
  creerFactureDepuisDevis(body.devisId, user.id, { remise: body.remise, modePaiement: body.modePaiement }),
);
