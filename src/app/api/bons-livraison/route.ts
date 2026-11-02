import { route } from "@/lib/api";
import { creerBonLivraison } from "@/lib/services/bl";
import { bonLivraisonSchema } from "@/lib/validators/bl";

export const POST = route({ permission: ["create", "bonLivraison"], body: bonLivraisonSchema }, async ({ body }) => creerBonLivraison(body));
