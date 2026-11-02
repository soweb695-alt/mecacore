import { idParam, route } from "@/lib/api";
import { modifierBonCommande, supprimerBonCommande } from "@/lib/services/bl";
import { bonCommandeEditionSchema } from "@/lib/validators/bl";

export const PATCH = route<ReturnType<typeof bonCommandeEditionSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "bonCommande"], body: bonCommandeEditionSchema },
  async ({ body, params }) => modifierBonCommande(idParam.parse(params).id, body),
);

export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["update", "bonCommande"] }, async ({ params }) =>
  supprimerBonCommande(idParam.parse(params).id),
);
