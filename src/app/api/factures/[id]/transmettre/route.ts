import { idParam, route } from "@/lib/api";
import { transmettreFacture } from "@/lib/services/factures";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "facture"] }, async ({ params }) => transmettreFacture(idParam.parse(params).id));
