import { idParam, route } from "@/lib/api";
import { marquerLivre } from "@/lib/services/bl";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "bonLivraison"] }, async ({ params }) => marquerLivre(idParam.parse(params).id));
