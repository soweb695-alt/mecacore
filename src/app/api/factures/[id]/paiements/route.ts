import { idParam, route } from "@/lib/api";
import { enregistrerPaiement } from "@/lib/services/factures";
import { paiementSchema } from "@/lib/validators/facture";

export const POST = route<ReturnType<typeof paiementSchema.parse>, undefined, { id: string }>(
  { permission: ["create", "paiement"], body: paiementSchema },
  async ({ body, params }) => enregistrerPaiement(idParam.parse(params).id, body),
);
