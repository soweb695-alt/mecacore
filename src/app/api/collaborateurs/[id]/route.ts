import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { BCRYPT_COST } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { collaborateurEdition } from "@/lib/validators/collaborateur";

export const PATCH = route<ReturnType<typeof collaborateurEdition.parse>, undefined, { id: string }>(
  { permission: ["update", "collaborateur"], body: collaborateurEdition },
  async ({ body, params, user }) => {
    const { id } = idParam.parse(params);
    const cible = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (!cible) throw new ApiError(404, "Collaborateur introuvable", "INTROUVABLE");

    // On ne peut pas se retirer ses propres droits ni supprimer le dernier administrateur actif.
    const perdAdmin = cible.role === "ADMIN" && cible.isActive && (body.role !== "ADMIN" || !body.isActive);
    if (perdAdmin) {
      if (id === user.id) throw new ApiError(409, "Vous ne pouvez pas retirer vos propres droits d'administrateur", "AUTO_RETRAIT");
      const autres = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
      if (autres === 0) throw new ApiError(409, "Il doit rester au moins un administrateur actif", "DERNIER_ADMIN");
    }
    await db.user.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        couleur: body.couleur ? body.couleur.toLowerCase() : null,
        isActive: body.isActive,
        ...(body.password ? { passwordHash: await bcrypt.hash(body.password, BCRYPT_COST) } : {}),
      },
    });
    return { id };
  },
);
