import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { couleurCollaborateur } from "@/lib/colors";
import { parisVersUtc } from "@/lib/time";
import { enregistrerRdv } from "@/lib/services/rdv";
import { rdvQuery, rdvSchema } from "@/lib/validators/rdv";

export const GET = route({ permission: ["read", "rdv"], query: rdvQuery }, async ({ query, user }) => {
  const rdvs = await db.rendezVous.findMany({
    where: { ...(user.role === "MECANICIEN" ? { userId: user.id } : {}), debut: { gte: parisVersUtc(`${query.du}T00:00`), lt: parisVersUtc(`${query.au}T23:59`) } },
    orderBy: { debut: "asc" },
    take: 500,
    include: { user: { select: { couleur: true } }, client: { select: { firstName: true, lastName: true, companyName: true, type: true } }, vehicule: { select: { marque: true, modele: true, immatriculation: true } } },
  });
  return rdvs.map((r) => ({ ...r, couleur: couleurCollaborateur(r.userId, r.user.couleur) }));
});

export const POST = route({ permission: ["create", "rdv"], body: rdvSchema }, async ({ body }) => enregistrerRdv(body));
