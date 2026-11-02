import { idParam, route } from "@/lib/api";
import { annulerFacture } from "@/lib/services/factures";

// Réservé à l'admin (action « delete » sur les factures).
export const POST = route<undefined, undefined, { id: string }>({ permission: ["delete", "facture"] }, async ({ params }) => annulerFacture(idParam.parse(params).id));
