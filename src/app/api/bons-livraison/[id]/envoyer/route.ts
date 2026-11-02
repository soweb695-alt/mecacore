import { idParam, route } from "@/lib/api";
import { envoyerBonLivraisonParEmail } from "@/lib/services/bl";

/** Renvoie le bon de livraison par e-mail (nouvel essai après un échec, ou renvoi demandé par le client). */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "bonLivraison"] }, async ({ params }) =>
  envoyerBonLivraisonParEmail(idParam.parse(params).id),
);
