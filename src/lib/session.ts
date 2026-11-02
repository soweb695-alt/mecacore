import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Action, type Resource, type Role } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Utilisateur courant, relu en base à chaque requête : un compte désactivé ou un
 * changement de rôle prend effet immédiatement, sans attendre l'expiration du JWT.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, firstName: true, lastName: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName };
});

/** Pour les pages serveur : redirige vers la connexion si non authentifié. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Pour les pages serveur : redirige vers l'accueil si le rôle n'a pas le droit. */
export async function requirePage(action: Action, resource: Resource): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, action, resource)) redirect(user.role === "MECANICIEN" ? "/ordres-reparation" : "/dashboard");
  return user;
}
