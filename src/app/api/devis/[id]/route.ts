import { idParam, route } from "@/lib/api";
import { modifierDevis } from "@/lib/services/devis";
import { devisSchema } from "@/lib/validators/devis";

export const PATCH = route<ReturnType<typeof devisSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "devis"], body: devisSchema },
  async ({ body, params }) => modifierDevis(idParam.parse(params).id, body),
);
