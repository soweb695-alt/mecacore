import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { idStr } from "@/lib/validators/common";

const body = z.object({ userId: idStr.nullable() });

/** Assignation d'un mécanicien (admin et secrétariat uniquement). */
export const PATCH = route<z.infer<typeof body>, undefined, { id: string }>({ permission: ["update", "ordre"], body }, async ({ user, body, params }) => {
  if (user.role === "MECANICIEN") throw new ApiError(403, "Accès refusé", "INTERDIT");
  const { id } = idParam.parse(params);
  if (body.userId) {
    const m = await db.user.findUnique({ where: { id: body.userId }, select: { role: true, isActive: true } });
    if (!m || !m.isActive || m.role !== "MECANICIEN") throw new ApiError(400, "Technicien invalide", "MECANICIEN_INVALIDE");
  }
  await db.ordreReparation.update({ where: { id }, data: { userId: body.userId } });
  return { id };
});
