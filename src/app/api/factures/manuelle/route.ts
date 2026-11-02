import { route } from "@/lib/api";
import { creerFactureManuelle } from "@/lib/services/factures";
import { factureManuelleSchema } from "@/lib/validators/facture";

/** « Nouvelle facture » : facture saisie directement, sans devis ni bon de livraison. */
export const POST = route({ permission: ["create", "facture"], body: factureManuelleSchema }, async ({ body, user }) => creerFactureManuelle(user.id, body));
