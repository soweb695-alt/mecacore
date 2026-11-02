import { route } from "@/lib/api";
import { creerBonCommande } from "@/lib/services/bl";
import { bonCommandeSchema } from "@/lib/validators/bl";

export const POST = route({ permission: ["create", "bonCommande"], body: bonCommandeSchema }, async ({ body }) => creerBonCommande(body));
