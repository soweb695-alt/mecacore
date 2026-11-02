import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { enregistrerTarif } from "@/lib/services/tarifs";
import { tarifSchema } from "@/lib/validators/piece";

export const PATCH = route<ReturnType<typeof tarifSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "tarif"], body: tarifSchema },
  async ({ body, params }) => {
    const { id } = idParam.parse(params);
    return enregistrerTarif(body, id);
  },
);

export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["delete", "tarif"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.tarif.update({ where: { id }, data: { actif: false } });
  return { id };
});
