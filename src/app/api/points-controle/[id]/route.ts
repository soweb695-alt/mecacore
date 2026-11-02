import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pointControleUpdateSchema } from "@/lib/validators/parametres";

export const PATCH = route<z.infer<typeof pointControleUpdateSchema>, undefined, { id: string }>({ permission: ["update", "parametre"], body: pointControleUpdateSchema }, async ({ body, params }) => {
  const { id } = idParam.parse(params);
  const p = await db.pointControle.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "Point introuvable", "INTROUVABLE");
  if (body.deplacer) {
    const liste = await db.pointControle.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    const i = liste.findIndex((x) => x.id === id);
    const j = body.deplacer === "haut" ? i - 1 : i + 1;
    if (j >= 0 && j < liste.length) {
      const [a] = liste.splice(i, 1);
      liste.splice(j, 0, a);
      await db.$transaction(liste.map((x, pos) => db.pointControle.update({ where: { id: x.id }, data: { position: pos } })));
    }
  }
  if (body.libelle !== undefined || body.isActive !== undefined) {
    await db.pointControle.update({ where: { id }, data: { ...(body.libelle !== undefined ? { libelle: body.libelle } : {}), ...(body.isActive !== undefined ? { isActive: body.isActive } : {}) } });
  }
  return { id };
});

export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["update", "parametre"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.pointControle.deleteMany({ where: { id } });
  return { id };
});
