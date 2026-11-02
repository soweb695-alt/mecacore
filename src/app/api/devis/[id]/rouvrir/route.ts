import { idParam, route } from "@/lib/api";
import { rouvrirDevis } from "@/lib/services/devis";

// Réservé à l'admin : seul ce rôle possède l'action "delete" sur les devis.
export const POST = route<undefined, undefined, { id: string }>({ permission: ["delete", "devis"] }, async ({ params }) =>
  rouvrirDevis(idParam.parse(params).id),
);
