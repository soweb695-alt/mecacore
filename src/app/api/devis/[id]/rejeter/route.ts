import { idParam, route } from "@/lib/api";
import { rejeterDevis } from "@/lib/services/devis";
import { rejetSchema } from "@/lib/validators/devis";

export const POST = route<ReturnType<typeof rejetSchema.parse>, undefined, { id: string }>(
  { permission: ["validate", "devis"], body: rejetSchema },
  async ({ body, params }) => {
    const { id } = idParam.parse(params);
    await rejeterDevis(id, body.motif);
    return { id };
  },
);
