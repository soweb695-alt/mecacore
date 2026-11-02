import { filtreClient } from "@/lib/client-search";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { creerDevis } from "@/lib/services/devis";
import { devisSchema, devisSearchQuery } from "@/lib/validators/devis";

/** Recherche légère de devis (sélecteur du formulaire de rendez-vous). */
export const GET = route({ permission: ["read", "devis"], query: devisSearchQuery }, async ({ query }) => {
  const q = query.q;
  const devis = await db.devis.findMany({
    where: {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: "insensitive" } },
              { client: filtreClient(q) },
              { vehicule: { immatriculation: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { dateCreation: "desc" },
    take: 20,
    select: {
      id: true, numero: true, type: true, statut: true, clientId: true, vehiculeId: true,
      client: { select: { type: true, firstName: true, lastName: true, companyName: true } },
      vehicule: { select: { immatriculation: true, marque: true, modele: true } },
    },
  });
  return devis;
});

export const POST = route({ permission: ["create", "devis"], body: devisSchema }, async ({ body, user }) => creerDevis(user.id, body));
