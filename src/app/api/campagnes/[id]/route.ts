import { idParam, route } from "@/lib/api";
import { modifierCampagne, supprimerCampagne } from "@/lib/services/campagnes";
import { campagneSchema } from "@/lib/validators/campagne";

export const PATCH = route<ReturnType<typeof campagneSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "campagne"], body: campagneSchema },
  async ({ body, params }) => modifierCampagne(idParam.parse(params).id, body),
);

export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["delete", "campagne"] }, async ({ params }) =>
  supprimerCampagne(idParam.parse(params).id),
);
