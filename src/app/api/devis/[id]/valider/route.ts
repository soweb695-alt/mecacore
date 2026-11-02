import { idParam, route } from "@/lib/api";
import { validerDevis } from "@/lib/services/devis";
import { validerSchema } from "@/lib/validators/devis";

export const POST = route<ReturnType<typeof validerSchema.parse>, undefined, { id: string }>(
  { permission: ["validate", "devis"], body: validerSchema },
  async ({ body, params }) => validerDevis(idParam.parse(params).id, body),
);
