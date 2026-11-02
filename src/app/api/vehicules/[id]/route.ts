import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { vehiculeData } from "@/lib/services/vehicules";
import { vehiculeSchema } from "@/lib/validators/vehicule";

/** Modification du véhicule, y compris son propriétaire (clientId). */
export const PATCH = route<ReturnType<typeof vehiculeSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "vehicule"], body: vehiculeSchema },
  async ({ body, params }) => {
    const { id } = idParam.parse(params);
    await db.vehicule.update({ where: { id }, data: vehiculeData(body) });
    return { id };
  },
);
