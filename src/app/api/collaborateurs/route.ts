import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { BCRYPT_COST } from "@/lib/auth";
import { collaborateurCreation } from "@/lib/validators/collaborateur";

export const POST = route({ permission: ["create", "collaborateur"], body: collaborateurCreation }, async ({ body }) => {
  const u = await db.user.create({
    data: { email: body.email, firstName: body.firstName, lastName: body.lastName, role: body.role, couleur: body.couleur ? body.couleur.toLowerCase() : null, passwordHash: await bcrypt.hash(body.password, BCRYPT_COST) },
    select: { id: true },
  });
  return u;
});
