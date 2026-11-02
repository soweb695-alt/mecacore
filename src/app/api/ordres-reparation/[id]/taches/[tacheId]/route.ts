import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { accesOrdre } from "@/lib/services/ordres";

const body = z.object({ terminee: z.boolean() });

export const PATCH = route<z.infer<typeof body>, undefined, { id: string; tacheId: string }>({ permission: ["update", "ordre"], body }, async ({ user, body, params }) => {
  const id = idParam.parse({ id: params.id }).id;
  const tacheId = idParam.parse({ id: params.tacheId }).id;
  await accesOrdre(user, id);
  const r = await db.tacheOR.updateMany({ where: { id: tacheId, ordreId: id }, data: { terminee: body.terminee } });
  if (r.count === 0) throw new ApiError(404, "Tâche introuvable", "INTROUVABLE");
  return { id: tacheId };
});
