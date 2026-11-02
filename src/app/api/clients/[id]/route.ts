import { db } from "@/lib/db";
import { ApiError, idParam, route } from "@/lib/api";
import { clientSchema } from "@/lib/validators/client";
import { clientData } from "@/lib/services/clients";

export const PATCH = route<ReturnType<typeof clientSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "client"], body: clientSchema },
  async ({ body, params }) => {
    const { id } = idParam.parse(params);
    const existant = await db.client.findUnique({ where: { id }, select: { anonymiseLe: true } });
    if (!existant) throw new ApiError(404, "Client introuvable", "INTROUVABLE");
    if (existant.anonymiseLe) throw new ApiError(409, "Ce client a été anonymisé", "ANONYMISE");
    await db.client.update({ where: { id }, data: clientData(body) });
    return { id };
  },
);
